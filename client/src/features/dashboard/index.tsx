import './chartTheme';
import TopBar from './components/TopBar';
import OperationalSnapshot from './components/OperationalSnapshot';
import NonConformanceSection from './components/NonConformanceSection';
import CapaComplaintsSection from './components/CapaComplaintsSection';
import DocumentsTrainingSection from './components/DocumentsTrainingSection';
import InspectionCalibrationSection from './components/InspectionCalibrationSection';
import AuditsRiskSection from './components/AuditsRiskSection';
import RecentActivity from './components/RecentActivity';
import './QualityCommandCenter.css';

export default function QualityCommandCenter() {
  return (
    <div className="qcc">
      <TopBar />
      <div className="wrap">
        <OperationalSnapshot />
        <NonConformanceSection />
        <CapaComplaintsSection />
        <DocumentsTrainingSection />
        <InspectionCalibrationSection />
        <AuditsRiskSection />
        <RecentActivity />
      </div>
    </div>
  );
}
