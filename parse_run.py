"""
parse_run.py - Parses Slay the Spire 2 .run files into a simplified JSON summary.

Schema goals:
  - Strip namespace prefixes (CARD., RELIC., MONSTER., ENCOUNTER., EVENT., POTION., ...).
  - Replace 64-bit Steam player IDs with a 0-based `index` in node entries.
  - Per-player per-node entries omit any zero/unchanged fields.
  - Card upgrades encoded inline as a `+N` suffix (e.g. "NOXIOUS_FUMES+1").
  - Top-level `killed_by` + `killed_at` directly answer "what ended the run".
  - Per-player aggregate totals pre-computed for fast analytics.
  - Pretty-printed JSON by default; pass --compact to emit minified output.

Usage:
    python parse_run.py <path_to_file_or_directory> [--output <path>] [--compact]
"""

import argparse
import json
import os
import sys

_PREFIXES = (
    "CARD.", "RELIC.", "MONSTER.", "ENCOUNTER.", "EVENT.",
    "POTION.", "ACT.", "CHARACTER.", "ROOM.",
)


def _strip(value):
    if not isinstance(value, str):
        return value
    for p in _PREFIXES:
        if value.startswith(p):
            return value[len(p):]
    return value


def _strip_list(values):
    return [_strip(v) for v in (values or [])]


def _card_label(card):
    """Encode a card object as 'ID' or 'ID+N' if upgraded."""
    if not card:
        return None
    cid = _strip(card.get("id"))
    lvl = card.get("current_upgrade_level") or 0
    return f"{cid}+{lvl}" if lvl else cid


# ---------------------------------------------------------------------------
# Choice extraction
# ---------------------------------------------------------------------------

def _card_pick(stats):
    choices = stats.get("card_choices") or []
    if not choices:
        return None, None
    picked = None
    skipped = []
    for c in choices:
        cid = _strip((c.get("card") or {}).get("id"))
        if c.get("was_picked"):
            picked = cid
        else:
            skipped.append(cid)
    return picked, skipped


def _relic_pick(stats):
    choices = stats.get("relic_choices") or []
    if not choices:
        return None, None
    picked = None
    skipped = []
    for c in choices:
        rid = _strip(c.get("choice"))
        if c.get("was_picked"):
            picked = rid
        else:
            skipped.append(rid)
    return picked, skipped


def _potion_pick(stats):
    choices = stats.get("potion_choices") or []
    if not choices:
        return None, None
    picked = []
    skipped = []
    for c in choices:
        pid = _strip(c.get("choice"))
        (picked if c.get("was_picked") else skipped).append(pid)
    return picked or None, skipped or None


def _ancient_pick(stats):
    choices = stats.get("ancient_choice") or []
    if not choices:
        return None, None
    picked = None
    skipped = []
    for c in choices:
        key = c.get("TextKey")
        if c.get("was_chosen"):
            picked = key
        else:
            skipped.append(key)
    return picked, skipped


# ---------------------------------------------------------------------------
# Per-player per-node
# ---------------------------------------------------------------------------

def _player_node_entry(stats, idx, prev_hp, prev_gold):
    e = {"index": idx}

    cur_hp = stats.get("current_hp")
    cur_gold = stats.get("current_gold")
    if cur_hp is not None and cur_hp != prev_hp:
        e["hp"] = cur_hp
    if cur_gold is not None and cur_gold != prev_gold:
        e["gold"] = cur_gold

    if stats.get("damage_taken"):
        e["damage_taken"] = stats["damage_taken"]
    if stats.get("hp_healed"):
        e["healed"] = stats["hp_healed"]
    if stats.get("max_hp_gained"):
        e["max_hp_gained"] = stats["max_hp_gained"]
    if stats.get("max_hp_lost"):
        e["max_hp_lost"] = stats["max_hp_lost"]
    if stats.get("gold_lost"):
        e["gold_lost"] = stats["gold_lost"]
    if stats.get("gold_stolen"):
        e["gold_stolen"] = stats["gold_stolen"]

    # Card pick / skip
    pick, skip = _card_pick(stats)
    if pick is not None:
        e["card_picked"] = pick
    if skip:
        e["cards_skipped"] = skip

    # Cards added outside the standard pick (events, shops, transforms)
    if stats.get("cards_gained"):
        gained = [_strip(c.get("id")) for c in stats["cards_gained"]]
        if pick and pick in gained:
            gained.remove(pick)
        if gained:
            e["cards_gained"] = gained

    if stats.get("cards_removed"):
        e["cards_removed"] = [_strip(c.get("id")) for c in stats["cards_removed"]]

    if stats.get("cards_transformed"):
        e["cards_transformed"] = [
            {"from": _strip((t.get("original_card") or {}).get("id")),
             "to": _strip((t.get("final_card") or {}).get("id"))}
            for t in stats["cards_transformed"]
        ]

    if stats.get("cards_enchanted"):
        items = []
        for x in stats["cards_enchanted"]:
            cid = _strip((x.get("card") or {}).get("id"))
            enc = x.get("enchantment")
            enc_id = _strip(enc.get("id")) if isinstance(enc, dict) else _strip(enc)
            items.append({"card": cid, "enchantment": enc_id})
        e["cards_enchanted"] = items

    if stats.get("upgraded_cards"):
        e["cards_upgraded"] = _strip_list(stats["upgraded_cards"])
    if stats.get("downgraded_cards"):
        e["cards_downgraded"] = _strip_list(stats["downgraded_cards"])

    # Relics
    rpick, rskip = _relic_pick(stats)
    if rpick is not None:
        e["relic_picked"] = rpick
    if rskip:
        e["relics_skipped"] = rskip
    if stats.get("bought_relics"):
        e["relics_bought"] = _strip_list(stats["bought_relics"])
    if stats.get("relics_removed"):
        e["relics_lost"] = _strip_list(stats["relics_removed"])

    # Potions
    ppick, pskip = _potion_pick(stats)
    if ppick is not None:
        e["potions_picked"] = ppick
    if pskip:
        e["potions_skipped"] = pskip
    if stats.get("bought_potions"):
        e["potions_bought"] = _strip_list(stats["bought_potions"])
    if stats.get("potion_used"):
        e["potions_used"] = _strip_list(stats["potion_used"])
    if stats.get("potion_discarded"):
        e["potions_discarded"] = _strip_list(stats["potion_discarded"])

    if stats.get("bought_colorless"):
        items = []
        for c in stats["bought_colorless"]:
            items.append(_strip(c.get("id") if isinstance(c, dict) else c))
        e["colorless_bought"] = items

    # Rest / event / Neow
    if stats.get("rest_site_choices"):
        rs = stats["rest_site_choices"]
        e["rest_choice"] = rs[0] if len(rs) == 1 else rs
    if stats.get("event_choices"):
        keys = [(c.get("title") or {}).get("key") for c in stats["event_choices"]]
        keys = [k for k in keys if k]
        if keys:
            e["event_choice"] = keys[0] if len(keys) == 1 else keys
    apick, askip = _ancient_pick(stats)
    if apick is not None:
        e["neow_choice"] = apick
    if askip:
        e["neow_skipped"] = askip

    if stats.get("completed_quests"):
        e["quests_completed"] = stats["completed_quests"]

    return e


def _parse_node(node, prev_hp, prev_gold):
    out = {"type": node.get("map_point_type")}

    rooms = node.get("rooms") or []
    if rooms:
        room = rooms[0]
        rt = room.get("room_type")
        if rt and rt != out["type"]:
            out["room_type"] = rt
        mid = _strip(room.get("model_id")) if room.get("model_id") else None
        if mid:
            if rt in ("monster", "elite", "boss"):
                out["encounter"] = mid
            elif rt == "event":
                out["event"] = mid
            else:
                out["model"] = mid
        if room.get("monster_ids"):
            out["monsters"] = _strip_list(room["monster_ids"])
        if room.get("turns_taken"):
            out["turns"] = room["turns_taken"]

    p_entries = []
    for idx, ps in enumerate(node.get("player_stats") or []):
        if not ps:
            continue
        entry = _player_node_entry(ps, idx, prev_hp.get(idx), prev_gold.get(idx))
        if ps.get("current_hp") is not None:
            prev_hp[idx] = ps["current_hp"]
        if ps.get("current_gold") is not None:
            prev_gold[idx] = ps["current_gold"]
        if len(entry) > 1:  # more than just `index`
            p_entries.append(entry)

    if p_entries:
        out["players"] = p_entries

    return out


# ---------------------------------------------------------------------------
# Top-level
# ---------------------------------------------------------------------------

def _build_player_summaries(data):
    raw_players = data.get("players") or []
    summaries = []
    for idx, p in enumerate(raw_players):
        deck = [_card_label(c) for c in (p.get("deck") or []) if c]
        relics = [_strip(r.get("id")) for r in (p.get("relics") or []) if r and r.get("id")]
        potions = [_strip(pt.get("id")) for pt in (p.get("potions") or []) if pt and pt.get("id")]
        summaries.append({
            "index": idx,
            "player_id": p.get("id"),
            "character": _strip(p.get("character")),
            "deck": deck,
            "relics": relics,
            "potions": potions,
            "max_potions": p.get("max_potion_slot_count"),
        })
    return summaries


def _aggregate_totals(map_history, n_players):
    totals = [{
        "damage_taken": 0, "healed": 0,
        "gold_earned": 0, "gold_spent": 0, "gold_lost": 0,
        "cards_added": 0, "cards_removed": 0, "cards_upgraded": 0,
        "potions_used": 0, "elites_visited": 0, "bosses_visited": 0,
        "hp_end": None, "max_hp_end": None, "gold_end": None,
    } for _ in range(n_players)]

    for act in map_history:
        for node in act:
            rt = (node.get("rooms") or [{}])[0].get("room_type") if node.get("rooms") else None
            for idx, ps in enumerate(node.get("player_stats") or []):
                if idx >= n_players or not ps:
                    continue
                t = totals[idx]
                t["damage_taken"] += ps.get("damage_taken", 0) or 0
                t["healed"] += ps.get("hp_healed", 0) or 0
                t["gold_earned"] += ps.get("gold_gained", 0) or 0
                t["gold_spent"] += ps.get("gold_spent", 0) or 0
                t["gold_lost"] += ps.get("gold_lost", 0) or 0
                t["cards_added"] += len(ps.get("cards_gained") or [])
                t["cards_removed"] += len(ps.get("cards_removed") or [])
                t["cards_upgraded"] += len(ps.get("upgraded_cards") or [])
                t["potions_used"] += len(ps.get("potion_used") or [])
                if ps.get("current_hp") is not None:
                    t["hp_end"] = ps["current_hp"]
                if ps.get("max_hp") is not None:
                    t["max_hp_end"] = ps["max_hp"]
                if ps.get("current_gold") is not None:
                    t["gold_end"] = ps["current_gold"]
            if rt == "elite":
                for t in totals:
                    t["elites_visited"] += 1
            elif rt == "boss":
                for t in totals:
                    t["bosses_visited"] += 1
    return totals


def _killed_at(map_history):
    """Return {act, node, type, id} for the node where any player hit 0 HP."""
    for a_idx, act in enumerate(map_history):
        for n_idx, node in enumerate(act):
            for ps in (node.get("player_stats") or []):
                if ps.get("current_hp") == 0:
                    room = (node.get("rooms") or [{}])[0]
                    return {
                        "act": a_idx + 1,
                        "node": n_idx + 1,
                        "type": node.get("map_point_type"),
                        "id": _strip(room.get("model_id")),
                    }
    return None


def parse_run(data: dict) -> dict:
    map_history = data.get("map_point_history") or []

    killed_by = None
    for key in ("killed_by_encounter", "killed_by_event"):
        v = data.get(key)
        if v and v != "NONE.NONE":
            killed_by = _strip(v)
            break

    players = _build_player_summaries(data)
    n_players = len(players)
    if n_players:
        totals = _aggregate_totals(map_history, n_players)
        for p, t in zip(players, totals):
            p["totals"] = t

    nodes = []
    prev_hp, prev_gold = {}, {}
    for a_idx, act_nodes in enumerate(map_history):
        for node in act_nodes:
            n = _parse_node(node, prev_hp, prev_gold)
            n["act"] = a_idx + 1
            nodes.append(n)

    meta = {
        "seed": data.get("seed"),
        "start_time": data.get("start_time"),
        "duration": data.get("run_time"),
        "ascension": data.get("ascension"),
        "game_mode": data.get("game_mode"),
        "build_id": data.get("build_id"),
        "schema_version": data.get("schema_version"),
        "acts": _strip_list(data.get("acts") or []),
        "win": bool(data.get("win")),
        "abandoned": bool(data.get("was_abandoned")),
        "killed_by": killed_by,
        "killed_at": _killed_at(map_history) if not data.get("win") else None,
        "player_count": n_players,
    }

    return {"meta": meta, "players": players, "nodes": nodes}


# ---------------------------------------------------------------------------
# I/O
# ---------------------------------------------------------------------------

def process_file(input_path, output_path=None, compact=False):
    with open(input_path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    simplified = parse_run(raw)

    if output_path is None:
        base = os.path.splitext(os.path.basename(input_path))[0]
        output_path = os.path.join(os.path.dirname(input_path), f"{base}.simplified.json")

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        if compact:
            json.dump(simplified, f, separators=(",", ":"))
        else:
            json.dump(simplified, f, indent=2)

    in_sz = os.path.getsize(input_path)
    out_sz = os.path.getsize(output_path)
    ratio = (1 - out_sz / in_sz) * 100 if in_sz else 0
    print(f"  {os.path.basename(input_path)} -> {os.path.basename(output_path)}  "
          f"({in_sz//1024}KB -> {out_sz//1024}KB, {ratio:.0f}% reduction)")


def main():
    p = argparse.ArgumentParser(description="Simplify STS2 .run files into concise JSON.")
    p.add_argument("input", help="Path to a .run file or a directory of .run files")
    p.add_argument("--output", "-o", default=None, help="Output file path or directory")
    p.add_argument("--compact", action="store_true",
                   help="Emit minified JSON (no indentation). Default is pretty-printed.")
    args = p.parse_args()

    if os.path.isdir(args.input):
        run_files = sorted(f for f in os.listdir(args.input) if f.endswith(".run"))
        if not run_files:
            print(f"No .run files in {args.input}")
            sys.exit(1)
        out_dir = args.output or os.path.join(args.input, "simplified")
        os.makedirs(out_dir, exist_ok=True)
        print(f"Processing {len(run_files)} files -> {out_dir}/")
        for fname in run_files:
            base = os.path.splitext(fname)[0]
            out_file = os.path.join(out_dir, f"{base}.simplified.json")
            try:
                process_file(os.path.join(args.input, fname), out_file, args.compact)
            except Exception as e:
                print(f"  ERROR {fname}: {e}")
    elif os.path.isfile(args.input):
        out_file = args.output
        if out_file is None:
            base = os.path.splitext(os.path.basename(args.input))[0]
            out_file = os.path.join(os.path.dirname(os.path.abspath(args.input)), f"{base}.simplified.json")
        process_file(args.input, out_file, args.compact)
    else:
        print(f"Error: '{args.input}' is not a valid file or directory.")
        sys.exit(1)


if __name__ == "__main__":
    main()
