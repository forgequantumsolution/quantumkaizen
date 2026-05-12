import { useEffect, useState, useCallback } from "react";
import {
  Table,
  Button,
  Select,
  Tag,
  Tooltip,
  Toast,
  Modal,
  DatePicker,
  Form,
} from "@nexgensis/core";
import {
  NxCalendar as Calendar,
  NxCheckCircle as CheckCircle,
  NxClock as Clock,
  NxAlertCircle as AlertCircle,
  NxEdit2 as Edit,
} from "@nexgensis/core";
import { useTranslation } from "react-i18next";
import PageWrapper from "@/components/UI/PageWrapper";
import { get_audit_schedules_with_info, update_audit_date, get_audit_schedule_filters } from "../api/form_apis";
import dayjs from "dayjs";

const AnnualAuditPlan = ({ onBack }) => {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [filters, setFilters] = useState({
    title: null,
    location_id: null,
    financial_year: null,
  });
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editForm, setEditForm] = useState({
    new_date: null,
  });
  const [saving, setSaving] = useState(false);
  const [focusAreasList, setFocusAreasList] = useState([]);

  // Dropdown options state
  const [dropdownOptions, setDropdownOptions] = useState({
    titles: [],
    locations: [],
    financialYears: [],
  });
  const [optionsLoading, setOptionsLoading] = useState(false);

  // Fetch dropdown options from dedicated filter API
  const fetchDropdownOptions = useCallback(() => {
    setOptionsLoading(true);

    get_audit_schedule_filters((res) => {
      const filterData = res?.data?.data || res?.data || {};

      // Map titles to {value, label} format for Select component
      const titles = (filterData.titles || []).map(title => ({
        value: title,
        label: title
      }));

      // Locations already in {id, name} format
      const locations = filterData.locations || [];

      // Financial years as strings
      const financialYears = filterData.financial_years || [];

      setDropdownOptions({
        titles,
        locations,
        financialYears,
      });

      setOptionsLoading(false);
    });
  }, []);

  // Helper function to get month status based on audit date
  const getMonthStatus = (auditDate, isActive) => {
    if (!auditDate) return null;
    const date = dayjs(auditDate);
    const month = date.month(); // 0-11

    // Determine status based on is_active and date comparison
    const today = dayjs();
    let status = "scheduled";
    if (date.isBefore(today, "day")) {
      status = isActive ? "completed" : "postponed";
    }

    return { month, status };
  };

  // Transform API response to table format
  const transformApiData = (apiData) => {
    return apiData.map((item) => {
      // Get audit date
      const auditDate = item.audit_date || null;
      const monthInfo = getMonthStatus(auditDate, item.is_active);

      // Initialize quarter data for calendar view
      const q1 = { april: null, may: null, june: null };
      const q2 = { july: null, aug: null, sept: null };
      const q3 = { oct: null, nov: null, dec: null };
      const q4 = { jan: null, feb: null, mar: null };

      // Set the status for the appropriate month
      if (monthInfo && auditDate) {
        const month = monthInfo.month;
        const status = monthInfo.status;

        if (month === 3) q1.april = status;
        else if (month === 4) q1.may = status;
        else if (month === 5) q1.june = status;
        else if (month === 6) q2.july = status;
        else if (month === 7) q2.aug = status;
        else if (month === 8) q2.sept = status;
        else if (month === 9) q3.oct = status;
        else if (month === 10) q3.nov = status;
        else if (month === 11) q3.dec = status;
        else if (month === 0) q4.jan = status;
        else if (month === 1) q4.feb = status;
        else if (month === 2) q4.mar = status;
      }

      // Format dates
      const planMonth = auditDate ? dayjs(auditDate).format("MMM-YY") : "-";
      const scheduledDate = auditDate ? dayjs(auditDate).format("DD-MMM-YY") : "-";
      const actualDate = item.previous_audit_date
        ? dayjs(item.previous_audit_date).format("DD-MMM-YY")
        : (auditDate ? dayjs(auditDate).format("DD-MMM-YY") : "-");

      // Direct mapping from API response
      return {
        id: item.schedule_id,
        // Plant / Group → item.plant
        plant_group: item.plant || "-",
        // Location → item.location[0].name
        location: item.location?.[0]?.name || "-",
        location_id: item.location?.[0]?.id || null,
        // Main Process → item.main_process[0].name
        main_process: item.main_process?.[0]?.name || "-",
        // Key Sub-Processes → item.sub_process[].name
        key_sub_processes: Array.isArray(item.sub_process)
          ? item.sub_process.map(sp => sp.name).filter(Boolean)
          : [],
        // Criteria → item.criteria[].name
        criteria: Array.isArray(item.criteria)
          ? item.criteria.map(c => c.name).filter(Boolean)
          : [],
        // Remarks → item.description
        remarks: item.description || "-",
        // Dates
        plan_month: planMonth,
        scheduled_date: scheduledDate,
        actual_date: actualDate,
        // Status
        status: item.is_active ? "scheduled" : "completed",
        // Focus Areas
        focus_areas: Array.isArray(item.focus_area)
          ? item.focus_area.map(fa => ({ id: fa.id, name: fa.name })).filter(fa => fa.id && fa.name)
          : [],
        // Other fields
        department: item.department?.[0]?.name || "-",
        created_by: item.created_by?.name || "-",
        audit_method: item.audit_method || "-",
        financial_year: item.financial_year || "-",
        // Quarter data for calendar
        q1,
        q2,
        q3,
        q4,
        // Keep original
        _original: item,
      };
    });
  };

  // Fetch audit plan data with query params
  const fetchAuditPlanData = useCallback(() => {
    // Only fetch if at least one filter is selected
    const hasFilters = filters.title || filters.location_id || filters.financial_year;

    if (!hasFilters) {
      setData([]);
      return;
    }

    setLoading(true);

    // Build query params from filters
    const queryParams = {};
    if (filters.title) queryParams.title = filters.title;
    if (filters.location_id) queryParams.location_id = filters.location_id;
    if (filters.financial_year) queryParams.financial_year = filters.financial_year;

    get_audit_schedules_with_info((res) => {
      if (res?.data?.data) {
        const transformedData = transformApiData(res.data.data);

        // Extract unique focus areas from all records
        const allFocusAreas = [];
        transformedData.forEach(record => {
          if (record.focus_areas?.length > 0) {
            record.focus_areas.forEach(fa => {
              if (!allFocusAreas.find(f => f.id === fa.id)) {
                allFocusAreas.push(fa);
              }
            });
          }
        });
        setFocusAreasList(allFocusAreas);

        setData(transformedData);
      } else if (res?.data) {
        const transformedData = transformApiData(res.data);
        setData(transformedData);
      } else {
        setData([]);
      }
      setLoading(false);
    }, queryParams);
  }, [filters]);

  // Fetch dropdown options on mount
  useEffect(() => {
    fetchDropdownOptions();
  }, [fetchDropdownOptions]);

  // Fetch audit data only when filters change (not on initial mount)
  useEffect(() => {
    const hasFilters = filters.title || filters.location_id || filters.financial_year;
    if (hasFilters) {
      fetchAuditPlanData();
    }
  }, [filters.title, filters.location_id, filters.financial_year, fetchAuditPlanData]);

  // Handle filter change and trigger API call
  // Ensure we always store primitive values, not objects
  const handleFilterChange = (filterKey, value) => {
    // Extract primitive value if Select returns an object
    let primitiveValue = value;
    if (value && typeof value === 'object') {
      primitiveValue = value.value || value.key || value.id || null;
    }
    setFilters(prev => ({ ...prev, [filterKey]: primitiveValue }));
  };

  // Render status cell with icon
  const renderStatusCell = (status, date) => {
    if (!status) return null;

    const statusConfig = {
      scheduled: {
        icon: <Calendar size={16} />,
        label: "Scheduled",
        bgClass: "bg-blue-100 text-blue-600 border border-blue-200 shadow-sm",
      },
      completed: {
        icon: <CheckCircle size={16} />,
        label: "Completed",
        bgClass: "bg-green-100 text-green-600 border border-green-200 shadow-sm",
      },
      postponed: {
        icon: <AlertCircle size={16} />,
        label: "Postponed",
        bgClass: "bg-orange-100 text-orange-600 border border-orange-200 shadow-sm",
      },
      plan: {
        icon: <Clock size={16} />,
        label: "Plan",
        bgClass: "bg-gray-100 text-gray-600 border border-gray-200 shadow-sm",
      },
    };

    const config = statusConfig[status] || statusConfig.plan;

    return (
      <Tooltip title={`${config.label}${date ? `: ${date}` : ""}`}>
        <div className={`inline-flex items-center justify-center p-2 rounded-lg ${config.bgClass} cursor-pointer hover:scale-110 transition-transform`}>
          {config.icon}
        </div>
      </Tooltip>
    );
  };

  // Handle edit button click
  const handleEditClick = (record) => {
    setEditingRecord(record);
    setEditForm({
      new_date: null,
    });
    setEditModalOpen(true);
  };

  // Handle save edit
  const handleSaveEdit = () => {
    if (!editingRecord || !editForm.new_date) {
      Toast.error(t("Please select a new date"));
      return;
    }

    setSaving(true);

    const scheduleId = editingRecord.id;
    const payload = {
      audit_date: editForm.new_date.format("YYYY-MM-DD"),
    };

    update_audit_date(scheduleId, payload, (res) => {
      setSaving(false);

      if (res?.data || res?.status === "success") {
        Toast.success(t("Audit date updated successfully"));
        setEditModalOpen(false);
        setEditingRecord(null);
        setEditForm({ new_date: null });
        // Refresh the data
        fetchAuditPlanData();
      } else {
        Toast.error(res?.message || t("Failed to update audit date"));
      }
    });
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditModalOpen(false);
    setEditingRecord(null);
    setEditForm({
      new_date: null,
    });
  };

  // Render month cell
  const renderMonthCell = (record, month, quarter) => {
    const quarterData = record[quarter];
    if (!quarterData) return null;

    const status = quarterData[month.toLowerCase()];
    if (!status) return null;

    return (
      <div className="flex justify-center">
        {renderStatusCell(status, record.scheduled_date)}
      </div>
    );
  };

  const columns = [
    {
      title: <span className="font-semibold">#</span>,
      dataIndex: "id",
      key: "id",
      width: 50,
      fixed: "left",
      align: "center",
      render: (_, __, index) => (
        <span className="font-semibold text-gray-700 bg-gray-50 px-2 py-1 rounded">{index + 1}</span>
      ),
    },
    {
      title: <span className="font-semibold">{t("Plant / Group")}</span>,
      dataIndex: "plant_group",
      key: "plant_group",
      width: 160,
      fixed: "left",
      render: (text) => (
        <span className="font-semibold text-blue-700 whitespace-nowrap">{text}</span>
      ),
    },
    {
      title: <span className="font-semibold">{t("Location")}</span>,
      dataIndex: "location",
      key: "location",
      width: 80,
      align: "center",
      render: (text) => (
        <span className="font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{text}</span>
      ),
    },
    {
      title: <span className="font-semibold">{t("Main Process")}</span>,
      dataIndex: "main_process",
      key: "main_process",
      width: 180,
      render: (text) => (
        <span className="font-medium text-gray-800 whitespace-nowrap">{text}</span>
      ),
    },
    {
      title: <span className="font-semibold">{t("Key Sub-Processes")}</span>,
      dataIndex: "key_sub_processes",
      key: "key_sub_processes",
      width: 200,
      render: (processes) => (
        <div className="flex flex-col">
          {processes?.map((proc, idx) => (
            <div
              key={idx}
              className="text-sm text-gray-700 whitespace-nowrap py-2 border-b border-gray-200 last:border-b-0 hover:bg-gray-50 transition-colors"
            >
              {proc}
            </div>
          ))}
        </div>
      ),
    },
    {
      title: <span className="font-semibold">{t("Criteria")}</span>,
      dataIndex: "criteria",
      key: "criteria",
      width: 120,
      align: "center",
      render: (criteria) => {
        if (!criteria || criteria.length === 0) {
          return <span className="text-gray-400">-</span>;
        }

        return (
          <div className="flex flex-col">
            {criteria.map((item, idx) => (
              <div
                key={idx}
                className="text-sm text-center font-medium py-2 border-b border-gray-200 last:border-b-0"
              >
                {item}
              </div>
            ))}
          </div>
        );
      },
    },
    {
      title: <span className="font-semibold">{t("Audit Status Details")}</span>,
      children: [
        {
          title: <span className="text-xs font-medium">{t("Plan/Scheduled/Actual")}</span>,
          dataIndex: "audit_status",
          key: "audit_status",
          width: 280,
          render: (_, record) => (
            <div className="flex flex-col text-sm">
              <div className="flex items-center gap-3 py-2 border-b border-gray-200">
                <span className="text-gray-500 whitespace-nowrap w-28 text-xs uppercase tracking-wide">Plan</span>
                <span className="font-semibold text-gray-800 whitespace-nowrap">{record.plan_month}</span>
              </div>
              <div className="flex items-center gap-3 py-2 border-b border-gray-200">
                <span className="text-gray-500 whitespace-nowrap w-28 text-xs uppercase tracking-wide">Scheduled</span>
                <span className="font-semibold text-gray-800 whitespace-nowrap">{record.scheduled_date}</span>
              </div>
              <div className="flex items-center gap-3 py-2">
                <span className="text-gray-500 whitespace-nowrap w-28 text-xs uppercase tracking-wide">Actual</span>
                <span className="font-semibold text-gray-800 whitespace-nowrap">{record.actual_date}</span>
              </div>
            </div>
          ),
        },
      ],
    },
    {
      title: <span className="font-semibold text-purple-700">Q1</span>,
      children: [
        {
          title: <span className="text-xs font-medium">{t("Apr")}</span>,
          dataIndex: "april",
          key: "april",
          width: 60,
          align: "center",
          render: (_, record) => renderMonthCell(record, "april", "q1"),
        },
        {
          title: <span className="text-xs font-medium">{t("May")}</span>,
          dataIndex: "may",
          key: "may",
          width: 60,
          align: "center",
          render: (_, record) => renderMonthCell(record, "may", "q1"),
        },
        {
          title: <span className="text-xs font-medium">{t("Jun")}</span>,
          dataIndex: "june",
          key: "june",
          width: 60,
          align: "center",
          render: (_, record) => renderMonthCell(record, "june", "q1"),
        },
      ],
    },
    {
      title: <span className="font-semibold text-indigo-700">Q2</span>,
      children: [
        {
          title: <span className="text-xs font-medium">{t("Jul")}</span>,
          dataIndex: "july",
          key: "july",
          width: 60,
          align: "center",
          render: (_, record) => renderMonthCell(record, "july", "q2"),
        },
        {
          title: <span className="text-xs font-medium">{t("Aug")}</span>,
          dataIndex: "aug",
          key: "aug",
          width: 60,
          align: "center",
          render: (_, record) => renderMonthCell(record, "aug", "q2"),
        },
        {
          title: <span className="text-xs font-medium">{t("Sep")}</span>,
          dataIndex: "sept",
          key: "sept",
          width: 60,
          align: "center",
          render: (_, record) => renderMonthCell(record, "sept", "q2"),
        },
      ],
    },
    {
      title: <span className="font-semibold text-teal-700">Q3</span>,
      children: [
        {
          title: <span className="text-xs font-medium">{t("Oct")}</span>,
          dataIndex: "oct",
          key: "oct",
          width: 60,
          align: "center",
          render: (_, record) => renderMonthCell(record, "oct", "q3"),
        },
        {
          title: <span className="text-xs font-medium">{t("Nov")}</span>,
          dataIndex: "nov",
          key: "nov",
          width: 60,
          align: "center",
          render: (_, record) => renderMonthCell(record, "nov", "q3"),
        },
        {
          title: <span className="text-xs font-medium">{t("Dec")}</span>,
          dataIndex: "dec",
          key: "dec",
          width: 60,
          align: "center",
          render: (_, record) => renderMonthCell(record, "dec", "q3"),
        },
      ],
    },
    {
      title: t("Remarks"),
      dataIndex: "remarks",
      key: "remarks",
      width: 250,
      render: (text) => (
        <Tooltip title={text}>
          <span className="text-sm text-gray-600 line-clamp-3">{text}</span>
        </Tooltip>
      ),
    },
    {
      title: t("Action"),
      key: "action",
      width: 80,
      fixed: "right",
      align: "center",
      render: (_, record) => (
        <div className="flex justify-center">
          <Tooltip title={t("Edit Audit Plan")}>
            <Button
              type="primary"
              size="small"
              icon={<Edit size={14} />}
              onClick={() => handleEditClick(record)}
              className="flex items-center justify-center shadow-sm hover:shadow-md transition-shadow"
            />
          </Tooltip>
        </div>
      ),
    },
  ];

  // Check if any filter is selected
  const hasFiltersSelected = filters.title || filters.location_id || filters.financial_year;

  // Generate dynamic subtitle based on selected filters
  const getSubTitle = () => {
    const parts = [];

    // Helper to safely get string value
    const safeString = (val) => {
      if (!val) return null;
      if (typeof val === 'string') return val;
      if (typeof val === 'object') {
        return val.label || val.value || val.name || String(val);
      }
      return String(val);
    };

    if (filters.title) {
      const titleValue = safeString(filters.title);
      const titleOption = dropdownOptions.titles.find(t => t.value === titleValue);
      const titleLabel = titleOption?.label ? safeString(titleOption.label) : titleValue;
      if (titleLabel) parts.push(titleLabel);
    }
    if (filters.location_id) {
      const locValue = safeString(filters.location_id);
      const location = dropdownOptions.locations.find(loc => loc.id === locValue);
      const locName = location?.name ? safeString(location.name) : null;
      if (locName) parts.push(locName);
    }
    if (filters.financial_year) {
      const fyValue = safeString(filters.financial_year);
      if (fyValue) parts.push(`FY ${fyValue}`);
    }
    return parts.length > 0 ? parts.join(" | ") : t("Select filters to view audit plan");
  };

  return (
    <PageWrapper
      title={t("Audit Plan")}
      subTitle={getSubTitle()}
      showBack={true}
      onBack={onBack}
      data-testid="annual-audit-plan-page"
      headerSiblingContent={
        <div className="flex flex-row gap-4 items-center flex-wrap">
          <Select
            size="large"
            placeholder={t("Select Title")}
            value={filters.title}
            onChange={(val) => handleFilterChange("title", val)}
            options={dropdownOptions.titles.map(opt => ({
              label: String(opt.label || ''),
              value: String(opt.value || '')
            }))}
            allowClear
            className="w-48"
            loading={optionsLoading}
          />
          <Select
            size="large"
            placeholder={t("Select Location")}
            value={filters.location_id}
            onChange={(val) => handleFilterChange("location_id", val)}
            options={dropdownOptions.locations.map(loc => ({
              label: String(loc.name || ''),
              value: String(loc.id || '')
            }))}
            allowClear
            className="w-48"
            loading={optionsLoading}
          />
          <Select
            size="large"
            placeholder={t("Select Financial Year")}
            value={filters.financial_year}
            onChange={(val) => handleFilterChange("financial_year", val)}
            options={dropdownOptions.financialYears.map(fy => ({
              label: String(fy || ''),
              value: String(fy || '')
            }))}
            allowClear
            className="w-48"
            loading={optionsLoading}
          />
        </div>
      }
    >
      {hasFiltersSelected ? (
        <>
          {/* Header Info Section */}
          <div className="border border-blue-100 rounded-lg p-5 mb-4 shadow-sm">
            {/* Row 1: Audit Frequency, Reference & Criteria */}
            <div className={`flex flex-wrap items-center gap-x-10 gap-y-3 text-base ${focusAreasList.length > 0 ? "border-b border-blue-200 pb-4 mb-4" : ""}`}>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">{t("AUDIT Frequency")}:</span>
                <span className="text-gray-600 bg-white px-2 py-0.5 rounded border border-gray-200">{t("Once in a Year")} (PDCA 17)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">{t("Reference")}:</span>
                <span className="text-gray-600 bg-white px-2 py-0.5 rounded border border-gray-200">Clause 9.2 of ISO Q HSE standards</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-700">{t("Criteria")}:</span>
                <Tag color="blue">ISO 9001:2015 (Quality)</Tag>
                <Tag color="green">ISO 14001:2015 (Environment)</Tag>
                <Tag color="orange">ISO 45001:2018 (Occupational Health & Safety)</Tag>
              </div>
            </div>

            {/* Row 2: Focus Areas - Dynamic from API */}
            {focusAreasList.length > 0 && (
              <div className="flex gap-4 text-base">
                <span className="font-semibold text-gray-700 whitespace-nowrap pt-3">{t("Focus Area")}:</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                  {[...focusAreasList].sort((a, b) => {
                    const aName = a.name || "";
                    const bName = b.name || "";
                    const aNum = parseInt(aName.match(/FA\s*(\d+)/i)?.[1] || "999");
                    const bNum = parseInt(bName.match(/FA\s*(\d+)/i)?.[1] || "999");
                    return aNum - bNum;
                  }).map((fa, index) => {
                    const faName = fa.name || `FA ${index + 1}`;
                    const faTitle = faName.split(":")[0]?.trim() || `FA ${index + 1}`;
                    const faDescription = faName.split(":").slice(1).join(":").trim() || faName;
                    return (
                      <div key={fa.id || index} className="flex gap-3 bg-white p-3 rounded-lg border border-gray-100">
                        <span className={`font-bold ${index % 2 === 0 ? "text-blue-700" : "text-indigo-700"} whitespace-nowrap`}>
                          {faTitle}:
                        </span>
                        <span className="text-gray-600 text-sm leading-relaxed">
                          {faDescription}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="bg-skin-card border border-border-skin-base rounded-lg p-4 mb-4 shadow-sm">
            <div className="flex items-center gap-8 text-base">
              <span className="font-semibold text-gray-700">{t("Legend")}:</span>
              <div className="flex items-center gap-2.5">
                <div className="inline-flex items-center justify-center p-2 rounded-lg bg-gray-100 text-gray-600 border border-gray-200 shadow-sm">
                  <Clock size={16} />
                </div>
                <span className="text-gray-600 font-medium">{t("Plan")}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="inline-flex items-center justify-center p-2 rounded-lg bg-blue-100 text-blue-600 border border-blue-200 shadow-sm">
                  <Calendar size={16} />
                </div>
                <span className="text-gray-600 font-medium">{t("Scheduled")}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="inline-flex items-center justify-center p-2 rounded-lg bg-green-100 text-green-600 border border-green-200 shadow-sm">
                  <CheckCircle size={16} />
                </div>
                <span className="text-gray-600 font-medium">{t("Completed")}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="inline-flex items-center justify-center p-2 rounded-lg bg-orange-100 text-orange-600 border border-orange-200 shadow-sm">
                  <AlertCircle size={16} />
                </div>
                <span className="text-gray-600 font-medium">{t("Postponed")}</span>
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-skin-card border border-border-skin-base rounded-lg overflow-hidden shadow-sm">
            <Table
              columns={columns}
              dataSource={data}
              loading={loading}
              rowKey="id"
              scroll={{ x: 1800, y: 550 }}
              pagination={false}
              bordered
              size="middle"
              className="annual-audit-plan-table"
              tableLayout="fixed"
              rowClassName="hover:bg-blue-50/30 transition-colors"
            />
          </div>
        </>
      ) : (
        <div className="bg-skin-card border border-border-skin-base rounded-lg p-12 shadow-sm">
          <div className="flex flex-col items-center justify-center text-center">
            <Calendar size={48} className="text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">
              {t("Select Filters to View Audit Plan")}
            </h3>
            <p className="text-sm text-gray-500 max-w-md">
              {t("Please select Title, Location, or Financial Year from the filters above to view the audit schedule data.")}
            </p>
          </div>
        </div>
      )}

      {/* Edit Dates Modal */}
      <Modal
        open={editModalOpen}
        onCancel={handleCancelEdit}
        title={
          <span className="text-lg font-semibold">
            {t("Edit Audit Date")} - {editingRecord?.plant_group || "-"}
          </span>
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={handleCancelEdit} disabled={saving}>{t("Cancel")}</Button>
            <Button type="primary" onClick={handleSaveEdit} loading={saving}>
              {t("Save Changes")}
            </Button>
          </div>
        }
        width={450}
      >
        <div className="py-4">
          <Form layout="vertical">
            <Form.Item label={t("New Audit Date")} required>
              <DatePicker
                value={editForm.new_date}
                onChange={(date) => setEditForm({ new_date: date })}
                format="DD-MMM-YYYY"
                className="w-full"
                placeholder={t("Select new audit date")}
                size="large"
              />
            </Form.Item>
          </Form>
        </div>
      </Modal>
    </PageWrapper>
  );
};

export default AnnualAuditPlan;