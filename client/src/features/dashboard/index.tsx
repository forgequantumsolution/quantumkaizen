import './chartTheme';
import TopBar from './components/TopBar';
import OperationalSnapshot from './components/OperationalSnapshot';
import ScorecardSection from './components/ScorecardSection';
import NonConformanceSection from './components/NonConformanceSection';
import CapaComplaintsSection from './components/CapaComplaintsSection';
import DocumentsTrainingSection from './components/DocumentsTrainingSection';
import InspectionCalibrationSection from './components/InspectionCalibrationSection';
import AuditsRiskSection from './components/AuditsRiskSection';
import RecentActivity from './components/RecentActivity';
import { DashboardProvider, useDashboard } from './context';
import './QualityCommandCenter.css';

function DashboardBody() {
  const { has, isLoading } = useDashboard();

  if (isLoading) {
    return (
      <div className="wrap">
        <div className="qcc-loading">
          <span className="live" /> Loading Quality Command Center…
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      {has('snapshot') && <OperationalSnapshot />}
      {has('scorecard') && <ScorecardSection />}
      {has('nonconformance') && <NonConformanceSection />}
      {(has('capa') || has('complaints')) && <CapaComplaintsSection />}
      {(has('documents') || has('training')) && <DocumentsTrainingSection />}
      {(has('inspection') || has('calibration')) && <InspectionCalibrationSection />}
      {has('audit') && <AuditsRiskSection />}
      {has('activity') && <RecentActivity />}
    </div>
  );
}

export default function QualityCommandCenter() {
  return (
    <DashboardProvider>
      <div className="qcc">
        <TopBar />
        <DashboardBody />
      </div>
    </DashboardProvider>
  );
}
