import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Overview from './views/Overview.jsx';
import Runs from './views/Runs.jsx';
import RunDetail from './views/RunDetail.jsx';
import EncounterAnalysis from './views/EncounterAnalysis.jsx';
import TimelineView from './views/TimelineView.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="runs" element={<Runs />} />
          <Route path="runs/:runId" element={<RunDetail />} />
          <Route path="encounters" element={<EncounterAnalysis />} />
          <Route path="timeline" element={<TimelineView />} />
          <Route path="*" element={<div className="state">Page not found.</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
