import React, { useState, useEffect } from "react";
import { Row, Col, Tooltip, Button, Modal } from "@nexgensis/core";
import {
  NxType as Text,
  NxAlignLeft as AlignLeft,
  NxHash as Hash,
  NxCalendarDays as CalendarDays,
  NxClock as Clock,
  NxChevronDown as ChevronDown,
  NxCircleDot as CircleDot,
  NxCheckCircle2 as CheckCircle2,
  NxFile as File,
  NxImage as Image,
  NxLock as Lock,
  NxSlidersHorizontal as SlidersHorizontal,
  NxBookOpenText as BookOpenText,
  NxPencil as Pencil,
  NxFileText as FileText,
  NxToggleRight as ToggleRight,
  NxTable2 as Table2,
  NxFilePlus as FilePlus,
  NxUser as User,
  NxCalendar as Calendar,
  NxShield as Shield,
  NxChevronRight as ChevronRight,
  NxChevronLeft as ChevronLeft,
  NxUsers as Users,
  NxMaximize2 as Maximize2,
} from "@nexgensis/core";
import mergeFieldsWithValues from "./MergeFieldsWithValues";
import dayjs from "dayjs";
import PDFViewerModal from "@/apps/DMSApp/dms/components/DocumentViewerModal";
import { get_file_upload } from "@/utils/api";

// Helper to get field span for grid layout (same as FormViewer)
const getFieldSpan = (field) => {
  // Table and textarea always take full width
  if (field.type === "table" || field.type === "textarea" || field.type === "richtext") {
    return { xs: 24, sm: 24, md: 24, lg: 24 };
  }

  const width = field.width || "half";
  switch (width) {
    case "full":
      return { xs: 24, sm: 24, md: 24, lg: 24 };
    case "half":
      return { xs: 24, sm: 24, md: 12, lg: 12 };
    case "third":
      return { xs: 24, sm: 12, md: 8, lg: 8 };
    case "quarter":
      return { xs: 24, sm: 12, md: 6, lg: 6 };
    default:
      return { xs: 24, sm: 24, md: 12, lg: 12 };
  }
};

// Helper function to check if a value is empty (undefined, null, empty string, or empty array)
const isEmptyValue = (value) => {
  if (value === undefined || value === null || value === '') {
    return true;
  }
  if (Array.isArray(value) && value.length === 0) {
    return true;
  }
  return false;
};

// Helper function to get field value from submission data or all sections
const getFieldValueFromSubmissions = (targetField, targetFieldId, submissionData, allSections) => {
  // First check if submissionData is a flat key-value object
  if (submissionData && typeof submissionData === 'object') {
    // Check if it's a flat object (not submission with field_values)
    const flatValue = submissionData[targetField];
    if (!isEmptyValue(flatValue)) {
      return flatValue;
    }

    // Check if it has field_values array (submission object format)
    if (submissionData.field_values && Array.isArray(submissionData.field_values)) {
      const fieldValue = submissionData.field_values.find(
        fv => fv.label === targetField || fv.field_id === targetFieldId
      );
      if (fieldValue && !isEmptyValue(fieldValue.value)) {
        return fieldValue.value;
      }
    }
  }

  // Search through all sections' submission data
  for (const section of allSections) {
    if (section.submission && Array.isArray(section.submission)) {
      for (const submission of section.submission) {
        if (submission.field_values && Array.isArray(submission.field_values)) {
          const fieldValue = submission.field_values.find(
            fv => fv.label === targetField || fv.field_id === targetFieldId
          );
          if (fieldValue && !isEmptyValue(fieldValue.value)) {
            return fieldValue.value;
          }
        }
      }
    }
  }

  return null;
};

// Helper function to check if a field should be visible based on its dependency
const isFieldVisible = (field, allSections, submissionData) => {
  // If no dependency is configured, field is always visible
  if (!field.dependency) {
    return true;
  }

  // Support both cascader format and individual fields format
  const {
    field_section,
    field_name,
    option_selected,
    options_selected,
    cascader_selection,
  } = field.dependency;

  // Support multiple field dependencies, cascader format, and individual fields format
  const { multiple_field_dependencies } = field.dependency;

  // Extract multiple field dependencies
  let fieldDependencies = [];

  if (multiple_field_dependencies && multiple_field_dependencies.length > 0) {
    // Use multiple field dependencies directly
    fieldDependencies = multiple_field_dependencies;
  } else if (cascader_selection && cascader_selection.length > 0) {
    // Extract from cascader_selection format: [[section, field, option1], [section, field, option2], ...]
    const pathsByField = {};
    cascader_selection.forEach((path) => {
      if (path.length >= 3) {
        const [section, field, option] = path;
        const key = `${section}|${field}`;
        if (!pathsByField[key]) {
          pathsByField[key] = {
            field_section: section,
            field_name: field,
            options_selected: [],
          };
        }
        pathsByField[key].options_selected.push(option);
      }
    });

    fieldDependencies = Object.values(pathsByField);
  } else if (field_section && field_name) {
    // Use individual fields (single dependency)
    const targetOptions =
      options_selected && options_selected.length > 0
        ? options_selected
        : option_selected
        ? [option_selected]
        : [];

    if (targetOptions.length > 0) {
      fieldDependencies = [
        {
          field_section,
          field_name,
          options_selected: targetOptions,
        },
      ];
    }
  }

  // If no valid dependency configuration, show field
  if (fieldDependencies.length === 0) {
    return true;
  }

  // Check if ANY of the target options match the current value for a single field
  const checkFieldDependency = (dependency) => {
    const {
      field_section: targetSection,
      field_name: targetField,
      options_selected: targetOptions,
    } = dependency;

    // Find the section that contains the dependency field
    const dependencySection = allSections.find(
      (section) => section.section_name === targetSection
    );

    if (!dependencySection) {
      return true; // If dependency section not found, consider condition met
    }

    // Find the dependency field
    const dependencyField = dependencySection.fields.find(
      (f) => f.name === targetField
    );

    if (!dependencyField) {
      return true; // If dependency field not found, consider condition met
    }

    // Get the current value from submission data or all sections
    const dependencyValue = getFieldValueFromSubmissions(
      targetField,
      dependencyField.field_id,
      submissionData,
      allSections
    );

    if (!dependencyValue) {
      return false; // If dependency field has no value, condition not met
    }

    // Check if any of the target options match the current value
    const checkValueMatch = (value) => {
      if (value === null || value === undefined) return false;

      // Handle object with value/label property
      const valueToCheck = typeof value === "object"
        ? (value.value || value.label || value)
        : value;

      return targetOptions.some((opt) => {
        const optValue = typeof opt === "object" ? (opt.value || opt.label || opt) : opt;
        return String(valueToCheck) === String(optValue);
      });
    };

    // Handle different value formats (string, object with value property, array)
    if (Array.isArray(dependencyValue)) {
      return dependencyValue.some(checkValueMatch);
    } else {
      return checkValueMatch(dependencyValue);
    }
  };

  // ALL field dependencies must be satisfied (AND logic)
  return fieldDependencies.every(checkFieldDependency);
};

const isFullWidth = (type) => {
  return ["textarea", "file", "image", "richtext", "table"].includes(type);
};

const hasValue = (field) => {
  const { value, type } = field;
  if (value === null || value === undefined || value === "") {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (type === "switch") {
    return true;
  }
  if (typeof value === "number") {
    return true;
  }
  return true;
};

const FileFieldView = ({ file, table }) => {
  const [resolvedUrl, setResolvedUrl] = useState(null);

  useEffect(() => {
    if (file?.file_id) {
      get_file_upload((res) => {
        if (res.status === 200) {
          const url = res.data?.data?.file_url || res.data?.file_url;
          if (url) setResolvedUrl(url);
        }
      }, file.file_id);
    }
  }, [file?.file_id]);

  return table ? (
    <div className="flex items-center space-x-2 text-xs text-blue-600 truncate max-w-xs">
      <span>{file.file_name || file.name || "File"}</span>
      <PDFViewerModal fileUrl={resolvedUrl} table={table} />
    </div>
  ) : (
    <div className="flex items-center space-x-2 p-2 bg-skin-fill-secondary rounded">
      <File className="w-4 h-4" />
      <span className="text-sm text-text-skin-base">{file.file_name}</span>
      <span className="text-xs text-text-skin-secondary">
        ({(file.file_size / 1024).toFixed(1)} KB)
      </span>
      <PDFViewerModal fileUrl={resolvedUrl} />
    </div>
  );
};

const getFieldIcon = (type) => {
  const iconProps = { className: "w-4 h-4 text-gray-500" };

  switch (type) {
    case "text":
      return <Text {...iconProps} />;
    case "textarea":
      return <AlignLeft {...iconProps} />;
    case "number":
      return <Hash {...iconProps} />;
    case "date":
    case "date_range":
      return <CalendarDays {...iconProps} />;
    case "time":
    case "time_range":
      return <Clock {...iconProps} />;
    case "select":
      return <ChevronDown {...iconProps} />;
    case "radio":
      return <CircleDot {...iconProps} />;
    case "checkbox":
      return <CheckCircle2 {...iconProps} />;
    case "file":
      return <File {...iconProps} />;
    case "image":
      return <Image {...iconProps} />;
    case "password":
      return <Lock {...iconProps} />;
    case "range":
      return <SlidersHorizontal {...iconProps} />;
    case "color":
      return <BookOpenText {...iconProps} />;
    case "signature":
      return <Pencil {...iconProps} />;
    case "richtext":
      return <FileText {...iconProps} />;
    case "switch":
      return <ToggleRight {...iconProps} />;
    case "table":
      return <Table2 {...iconProps} />;
    default:
      return <FilePlus {...iconProps} />;
  }
};

const RenderTableValue = ({ field }) => {
  const { value, fields } = field;
  const [detailModal, setDetailModal] = useState({ open: false, title: "", text: "" });
  const [rowDetailModal, setRowDetailModal] = useState({ open: false, rowIndex: -1 });
  const TEXT_LIMIT = 40;

  if (!value || !Array.isArray(value) || value.length === 0) {
    return (
      <div className="text-center py-8 text-text-skin-secondary">
        <p className="text-sm">No table data submitted</p>
      </div>
    );
  }

  // Helper: render long text with 2-line clamp + expand icon
  const renderTruncatedText = (text, label) => {
    if (!text || text.length <= TEXT_LIMIT) {
      return <span className="text-sm text-text-skin-secondary">{text || "—"}</span>;
    }
    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: "4px" }}>
        <Tooltip title={text} overlayStyle={{ maxWidth: "420px" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", fontSize: "13px", lineHeight: "1.4" }}>
            {text}
          </span>
        </Tooltip>
        <Tooltip title="View Full Content">
          <Button
            type="text"
            size="small"
            icon={<Maximize2 style={{ fontSize: "13px" }} />}
            style={{ flexShrink: 0, color: "#3b82f6", padding: "2px 4px", height: "auto" }}
            onClick={() => setDetailModal({ open: true, title: label, text })}
          />
        </Tooltip>
      </div>
    );
  };

  // Helper function to render individual cell values based on field type
  const renderCellValue = (cellValue, tableField) => {
    if (!cellValue && cellValue !== 0 && cellValue !== false) {
      return <span className="text-text-skin-secondary">—</span>;
    }

    switch (tableField.type) {
      case "select": {
        let text;
        if (typeof cellValue === "object") {
          text = Array.isArray(cellValue)
            ? cellValue.map((item) => item.label || item.value || item).join(", ")
            : cellValue.label || cellValue.value || String(cellValue);
        } else {
          text = String(cellValue);
        }
        return renderTruncatedText(text, tableField.label);
      }

      case "checkbox": {
        const text = Array.isArray(cellValue)
          ? cellValue.map((item) => typeof item === "object" ? item.label || item.value || item : item).join(", ")
          : String(cellValue);
        return renderTruncatedText(text, tableField.label);
      }

      case "radio": {
        const text = typeof cellValue === "object" ? (cellValue.label || cellValue.value || String(cellValue)) : String(cellValue);
        return renderTruncatedText(text, tableField.label);
      }

      case "switch":
        return (
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${
              cellValue
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
            }`}
          >
            {cellValue ? "Yes" : "No"}
          </span>
        );

      case "date":
        return (
          <span className="text-sm text-text-skin-base">
            {dayjs(cellValue).format("DD-MM-YYYY")}
          </span>
        );

      case "time":
        return <span className="text-sm text-text-skin-base">{cellValue}</span>;

      case "datetime":
        return (
          <span className="text-sm text-text-skin-base">
            {dayjs(cellValue).format("DD-MM-YYYY HH:mm")}
          </span>
        );

      case "color":
        return (
          <div className="flex items-center space-x-2">
            <div
              className="w-4 h-4 rounded border border-border-skin-base flex-shrink-0"
              style={{ backgroundColor: cellValue }}
            />
            <span className="text-sm text-text-skin-secondary">
              {cellValue}
            </span>
          </div>
        );

      case "range":
        return (
          <div className="flex items-center space-x-2 min-w-[100px]">
            <div className="flex-1 bg-skin-card rounded-full h-1.5">
              <div
                className="bg-blue-600 h-1.5 rounded-full"
                style={{ width: `${Math.min(Math.max(cellValue, 0), 100)}%` }}
              />
            </div>
            <span className="text-xs text-text-skin-secondary flex-shrink-0">
              {cellValue}
            </span>
          </div>
        );

      case "number":
        return (
          <span className="text-sm text-text-skin-base font-mono">
            {cellValue}
          </span>
        );

      case "text":
      case "textarea":
      case "richtext": {
        const text = typeof cellValue === "string" && /<[^>]+>/.test(cellValue)
          ? cellValue.replace(/<[^>]+>/g, "").trim()
          : String(cellValue);
        if (typeof text === "string" && /^https?:\/\//i.test(text.trim())) {
          return (
            <a
              href={text.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              View Document
            </a>
          );
        }
        return renderTruncatedText(text, tableField.label);
      }

      case "file":
        if (Array.isArray(cellValue)) {
          return (
            <div className="space-y-1">
              {cellValue.map((file, idx) => <FileFieldView key={idx} file={file} table={true} />)}
            </div>
          );
        }
        return (
          <div className="text-xs text-blue-600 truncate max-w-xs">
            <FileFieldView file={cellValue} table={true} />
          </div>
        );

      case "image":
        if (Array.isArray(cellValue)) {
          return (
            <div className="flex -space-x-2">
              {cellValue.slice(0, 3).map((image, idx) => (
                <img
                  key={idx}
                  src={image.file_url || image.url}
                  alt={image.file_name || `Image ${idx + 1}`}
                  className="w-8 h-8 rounded border-2 border-white object-cover"
                />
              ))}
              {cellValue.length > 3 && (
                <div className="w-8 h-8 rounded border-2 border-white bg-gray-100 flex items-center justify-center text-xs">
                  +{cellValue.length - 3}
                </div>
              )}
            </div>
          );
        }
        return (
          <img
            src={cellValue.file_url || cellValue.url}
            alt={cellValue.file_name || "Image"}
            className="w-8 h-8 rounded border object-cover"
          />
        );

      default: {
        const text = Array.isArray(cellValue) ? cellValue.join(", ") : String(cellValue);
        // Detect URLs and render as clickable link
        if (typeof text === "string" && /^https?:\/\//i.test(text.trim())) {
          return (
            <a
              href={text.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              View Document
            </a>
          );
        }
        return renderTruncatedText(text, tableField.label);
      }
    }
  };

  // Helper: get plain text value for row detail modal
  const getPlainValue = (cellValue, tableField) => {
    if (!cellValue && cellValue !== 0 && cellValue !== false) return "—";
    switch (tableField.type) {
      case "select":
        if (typeof cellValue === "object") {
          return Array.isArray(cellValue)
            ? cellValue.map((item) => item.label || item.value || item).join(", ")
            : cellValue.label || cellValue.value || String(cellValue);
        }
        return String(cellValue);
      case "checkbox":
        return Array.isArray(cellValue)
          ? cellValue.map((item) => typeof item === "object" ? item.label || item.value || item : item).join(", ")
          : String(cellValue);
      case "radio":
        return typeof cellValue === "object" ? (cellValue.label || cellValue.value || String(cellValue)) : String(cellValue);
      case "switch":
        return cellValue ? "Yes" : "No";
      case "date":
        return dayjs(cellValue).format("DD-MM-YYYY");
      case "datetime":
        return dayjs(cellValue).format("DD-MM-YYYY HH:mm");
      case "file":
        if (Array.isArray(cellValue)) return cellValue.map(f => f.file_name || f.name || "File").join(", ");
        return cellValue?.file_name || cellValue?.name || "File";
      case "image":
        if (Array.isArray(cellValue)) return `${cellValue.length} image(s)`;
        return "1 image";
      case "text":
      case "textarea":
      case "richtext":
        if (typeof cellValue === "string" && /<[^>]+>/.test(cellValue))
          return cellValue.replace(/<[^>]+>/g, "").trim();
        return String(cellValue);
      default:
        return Array.isArray(cellValue) ? cellValue.join(", ") : String(cellValue);
    }
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-full border border-border-skin-base rounded-lg overflow-hidden">
        {/* Table Header */}
        <div className="bg-skin-card border-b border-border-skin-base">
          <div
            className="grid"
            style={{
              gridTemplateColumns: `40px repeat(${
                fields?.length || 1
              }, minmax(120px, 1fr))`,
            }}
          >
            <div className="px-2 py-2 text-center text-xs font-semibold text-text-skin-base uppercase tracking-wider border-r border-border-skin-base">
              #
            </div>
            {fields?.map((tableField, index) => (
              <div
                key={tableField.field_id || tableField.name || index}
                className={`px-3 py-2 text-left text-xs font-semibold text-text-skin-base uppercase tracking-wider ${
                  index < fields.length - 1
                    ? "border-r border-border-skin-base"
                    : ""
                }`}
              >
                <div className="flex items-center space-x-1">
                  {getFieldIcon(tableField.type)}
                  <span className="truncate">{tableField.label}</span>
                  {tableField.required && (
                    <span className="text-red-500 text-xs">*</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Table Body */}
        <div className="bg-skin-card">
          {value.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className={`grid border-b border-border-skin-base last:border-b-0 ${
                rowIndex % 2 === 0
                  ? "bg-white dark:bg-gray-800"
                  : "bg-gray-50 dark:bg-gray-700"
              }`}
              style={{
                gridTemplateColumns: `40px repeat(${
                  fields?.length || 1
                }, minmax(120px, 1fr))`,
              }}
            >
              {/* Row number + View button */}
              <div className="px-2 py-3 flex items-center justify-center border-r border-border-skin-base">
                <Tooltip title="View Full Record">
                  <Button
                    type="text"
                    size="small"
                    style={{ padding: "2px 6px", height: "auto", fontSize: "12px", color: "#3b82f6", fontWeight: 600 }}
                    onClick={() => setRowDetailModal({ open: true, rowIndex })}
                  >
                    {rowIndex + 1}
                  </Button>
                </Tooltip>
              </div>
              {fields?.map((tableField, colIndex) => {
                const cellValue = row[tableField.name];
                return (
                  <div
                    key={`${rowIndex}-${
                      tableField.field_id || tableField.name || colIndex
                    }`}
                    className={`px-3 py-3 text-sm ${
                      colIndex < fields.length - 1
                        ? "border-r border-border-skin-base"
                        : ""
                    }`}
                    style={{ maxHeight: "80px", overflow: "hidden" }}
                  >
                    {renderCellValue(cellValue, tableField)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Table Footer with Row Count */}
        <div className="bg-skin-card border-t border-border-skin-base px-3 py-2">
          <div className="flex justify-between items-center text-xs text-text-skin-secondary">
            <span>
              {value.length} {value.length === 1 ? "row" : "rows"}
            </span>
            <span>
              {fields?.length || 0}{" "}
              {fields?.length === 1 ? "column" : "columns"}
            </span>
          </div>
        </div>
      </div>

      {/* Detail Modal for long text content */}
      <Modal
        open={detailModal.open}
        onCancel={() => setDetailModal({ open: false, title: "", text: "" })}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "4px", height: "20px", backgroundColor: "#3b82f6", borderRadius: "4px", display: "inline-block" }} />
            <span>{detailModal.title}</span>
          </div>
        }
        footer={[
          <Button key="close" onClick={() => setDetailModal({ open: false, title: "", text: "" })}>
            Close
          </Button>,
        ]}
        width="70vw"
        style={{ maxWidth: 900, top: 40 }}
        styles={{ body: { maxHeight: "60vh", overflow: "auto" } }}
      >
        <div style={{ padding: "12px 0", whiteSpace: "pre-wrap", fontSize: "14px", lineHeight: "1.8", color: "#334155" }}>
          {detailModal.text}
        </div>
      </Modal>

      {/* Row Detail Modal */}
      <Modal
        open={rowDetailModal.open}
        onCancel={() => setRowDetailModal({ open: false, rowIndex: -1 })}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "4px", height: "20px", backgroundColor: "#3b82f6", borderRadius: "4px", display: "inline-block" }} />
            <span>Record {rowDetailModal.rowIndex + 1} of {value?.length || 0}</span>
          </div>
        }
        footer={[
          rowDetailModal.rowIndex > 0 && (
            <Button key="prev" onClick={() => setRowDetailModal(prev => ({ ...prev, rowIndex: prev.rowIndex - 1 }))}>
              <ChevronLeft style={{ fontSize: "14px" }} /> Prev
            </Button>
          ),
          rowDetailModal.rowIndex < (value?.length || 1) - 1 && (
            <Button key="next" onClick={() => setRowDetailModal(prev => ({ ...prev, rowIndex: prev.rowIndex + 1 }))}>
              Next <ChevronRight style={{ fontSize: "14px" }} />
            </Button>
          ),
          <Button key="close" onClick={() => setRowDetailModal({ open: false, rowIndex: -1 })}>
            Close
          </Button>,
        ].filter(Boolean)}
        width="70vw"
        style={{ maxWidth: 900, top: 40 }}
        styles={{ body: { maxHeight: "65vh", overflow: "auto" } }}
      >
        {rowDetailModal.rowIndex >= 0 && value?.[rowDetailModal.rowIndex] && (
          <div style={{ padding: "8px 0" }}>
            {fields?.map((tableField, idx) => {
              const cellValue = value[rowDetailModal.rowIndex][tableField.name];
              const displayValue = getPlainValue(cellValue, tableField);
              return (
                <div
                  key={tableField.field_id || tableField.name || idx}
                  style={{
                    display: "flex",
                    borderBottom: idx < fields.length - 1 ? "1px solid #e5e7eb" : "none",
                    padding: "10px 0",
                  }}
                >
                  <div style={{ width: "30%", paddingRight: "12px", fontSize: "13px", fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: "0.3px" }}>
                    {tableField.label}
                  </div>
                  <div style={{ width: "70%", fontSize: "14px", lineHeight: "1.6", color: "#1f2937", whiteSpace: "pre-wrap" }}>
                    {displayValue}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* Responsive Table for Mobile */}
      <div className="md:hidden mt-4">
        <div className="space-y-4">
          {value.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className="bg-skin-card border border-border-skin-base rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-text-skin-base">
                  Row {rowIndex + 1}
                </span>
              </div>
              <div className="space-y-3">
                {fields?.map((tableField, colIndex) => {
                  const cellValue = row[tableField.name];
                  return (
                    <div key={colIndex} className="flex flex-col space-y-1">
                      <div className="flex items-center space-x-1">
                        {getFieldIcon(tableField.type)}
                        <span className="text-xs font-medium text-text-skin-base uppercase tracking-wide">
                          {tableField.label}
                        </span>
                        {tableField.required && (
                          <span className="text-red-500 text-xs">*</span>
                        )}
                      </div>
                      <div className="ml-4">
                        {renderCellValue(cellValue, tableField)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Wrapper to maintain backward compatibility (was a plain function, now a component with state)
const renderTableValue = (field) => <RenderTableValue field={field} />;

const renderFieldValue = (field) => {
  const { type, value } = field;
  if (!value && value !== 0 && value !== false) {
    return <span className="text-text-skin-secondary">—</span>;
  }

  switch (type) {
    case "text":
    case "textarea":
    case "password":
      return (
        <span className="text-base text-text-skin-secondary  font-medium">
          {typeof value === "object" ? (value.value || value.label || "") : value}
        </span>
      );

    case "number":
      return (
        <span className="text-base text-text-skin-secondary font-medium">
          {typeof value === "object" ? (value.value || value.label || "") : value}
        </span>
      );

    case "date": {
      const dateValue = typeof value === "object" ? (value.value || value.label) : value;
      return (
        <span className="text-base text-text-skin-base font-medium">
          {/* {new Date(value).toLocaleDateString()} */}
          {dayjs(dateValue).format("DD-MM-YYYY")}
        </span>
      );
    }

    case "date_range": {
      const dateRangeValue = typeof value === "object" ? (value.value || value) : value;
      const dateStart = Array.isArray(dateRangeValue) ? dateRangeValue[0] : dateRangeValue;
      const dateEnd = Array.isArray(dateRangeValue) ? dateRangeValue[1] : dateRangeValue;
      return (
        <span className="text-base text-text-skin-secondary font-medium">
          {/* {new Date(value[0]).toLocaleDateString()} -{" "}
          {new Date(value[1]).toLocaleDateString()} */}
          {dayjs(dateStart).format("DD-MM-YYYY")} -{" "}
          {dayjs(dateEnd).format("DD-MM-YYYY")}
        </span>
      );
    }

    case "time":
      return (
        <span className="text-base text-text-skin-base font-medium">
          {typeof value === "object" ? (value.value || value.label || "") : value}
        </span>
      );

    case "time_range": {
      const timeRangeValue = typeof value === "object" ? (value.value || value) : value;
      const timeStart = Array.isArray(timeRangeValue) ? timeRangeValue[0] : "";
      const timeEnd = Array.isArray(timeRangeValue) ? timeRangeValue[1] : "";
      return (
        <span className="text-base text-text-skin-secondary font-medium">
          {timeStart} - {timeEnd}
        </span>
      );
    }

    case "select":
      return (
        <span className="text-base text-text-skin-secondary font-medium">
          {Array.isArray(value)
            ? value.map((i) => (typeof i === "object" ? (i.label || i.value || "") : i)).join(", ")
            : (typeof value === "object" ? (value.label || value.value || "") : value)}
        </span>
      );

    case "radio":
      return (
        <span className="text-base text-text-skin-base font-medium">
          {typeof value === "object" ? (value.label || value.value || "") : value}
        </span>
      );

    case "checkbox":
      return (
        <span className="text-base text-text-skin-secondary font-medium">
          {Array.isArray(value)
            ? value.map((i) => (typeof i === "object" ? (i.label || i.value || "") : i)).join(", ")
            : (typeof value === "object" ? (value.label || value.value || "") : value)}
        </span>
      );

    case "file":
      if (Array.isArray(value)) {
        return (
          <div className="space-y-2">
            {value.map((file, index) => (
              <FileFieldView key={index} file={file} />
            ))}
          </div>
        );
      } else {
        return <FileFieldView file={value} />;
      }

    case "image":
      if (Array.isArray(value)) {
        return (
          <div className="grid grid-cols-2 gap-2">
            {value.map((image, index) => (
              <div key={index} className="space-y-1">
                <img
                  src={image.file_url}
                  alt={image.file_name}
                  className="w-full h-32 object-cover rounded border"
                />
                <p className="text-xs text-text-skin-secondary truncate">
                  {image.file_name}
                </p>
              </div>
            ))}
          </div>
        );
      } else {
        return (
          <div className="space-y-1">
            <img
              src={value.file_url}
              alt={value.file_name}
              className="h-64 object-cover rounded border"
            />
            <p className="text-xs text-text-skin-secondary truncate">
              {value.file_name}
            </p>
          </div>
        );
      }

    case "range":
      return (
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <div className="flex-1 bg-skin-card rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${value}%` }}
              ></div>
            </div>
            <span className="text-sm text-text-skin-secondary">{value}</span>
          </div>
        </div>
      );

    case "color":
      return (
        <div className="flex items-center space-x-2">
          <div
            className="w-6 h-6 rounded border border-border-skin-base"
            style={{ backgroundColor: value }}
          ></div>
          <span className="text-base text-text-skin-secondary font-medium">
            {value}
          </span>
        </div>
      );

    case "signature":
      return (
        <div className="border border-border-skin-base rounded p-2 bg-skin-card">
          <img
            src={value}
            alt="Signature"
            className="max-w-full h-20 object-contain"
          />
        </div>
      );

    case "richtext": {
      const richtextValue = typeof value === "object" ? (value.value || value.label || "") : value;
      return (
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: richtextValue }}
        />
      );
    }

    case "switch":
      return (
        <span className="text-base text-text-skin-base font-medium">
          {value ? "Yes" : "No"}
        </span>
      );

    case "table":
      return renderTableValue(field);

    default: {
      const defaultValue = typeof value === "object" ? (value.value || value.label || "") : value;
      return (
        <span className="text-base text-text-skin-secondary font-medium">
          {Array.isArray(defaultValue) ? defaultValue.join(", ") : defaultValue || "—"}
        </span>
      );
    }
  }
};

const getRoleBadgeColor = (role) => {
  switch (role?.toLowerCase()) {
    case "administrator":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "qa":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "manager":
      return "bg-green-100 text-green-800 border-green-200";
    case "user":
      return "bg-gray-100 text-gray-800 border-gray-200";
    default:
      return "bg-indigo-100 text-indigo-800 border-indigo-200";
  }
};

const SubmissionCard = ({
  submission,
  fields,
  submissionIndex,
  totalSubmissions,
  allSections = [],
  showEmptyFields = true,
}) => {
  // First merge fields with submission values and filter by visibility
  const visibleFields = mergeFieldsWithValues(fields, submission)
    .filter((field) => isFieldVisible(field, allSections, submission));

  // Optionally filter out empty fields
  const fieldsWithValues = showEmptyFields
    ? visibleFields
    : visibleFields.filter(hasValue);

  return (
    <div className="space-y-4">
      {/* Submission Header - Compact inline */}
      <div className="flex items-center justify-between px-1 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 text-sm text-text-skin-secondary">
          <User className="w-4 h-4" />
          <span className="font-medium text-text-skin-base">{submission.submitted_by}</span>
          <span className="text-gray-400">|</span>
          <span>{submission.role}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-text-skin-secondary">
          <span>{dayjs(submission.submitted_at).format("DD-MM-YYYY HH:mm")}</span>
          {totalSubmissions > 1 && (
            <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
              {submissionIndex + 1}/{totalSubmissions}
            </span>
          )}
        </div>
      </div>

      {/* Submission Content - Same grid layout as form */}
      {fieldsWithValues.length === 0 ? (
        <div className="text-center py-6 text-text-skin-secondary text-sm">
          No data submitted
        </div>
      ) : (
        <Row gutter={[20, 20]}>
          {fieldsWithValues.map((field) => (
            <Col key={field.field_id || field.name} {...getFieldSpan(field)}>
              {/* Label - Same style as form */}
              <div className="mb-1">
                <span className="text-text-skin-base font-medium text-base">
                  {field.label}
                </span>
                {field.required && (
                  <span className="text-red-500 ml-1">*</span>
                )}
              </div>
              {/* Value - Displayed like disabled input */}
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-md min-h-[40px]">
                {renderFieldValue(field)}
              </div>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
};

export const SectionFormPreview = ({ section, allSections = [] }) => {
  const [selectedSubmissionIndex, setSelectedSubmissionIndex] = useState(0);
  const [viewMode, setViewMode] = useState("single");

  const submissions =
    section.submission?.filter((i) => Boolean(i.submitted_at)) || [];
  const hasMultipleSubmissions = submissions.length > 1;

  const nextSubmission = () => {
    setSelectedSubmissionIndex((prev) =>
      prev < submissions.length - 1 ? prev + 1 : 0
    );
  };

  const prevSubmission = () => {
    setSelectedSubmissionIndex((prev) =>
      prev > 0 ? prev - 1 : submissions.length - 1
    );
  };

  return (
    <div className="space-y-4 ">
      {hasMultipleSubmissions && (
        <div className="flex items-center space-x-2 ">
          {/* Toggle View Mode */}
          <button
            type="button"
            onClick={() =>
              setViewMode(viewMode === "single" ? "all" : "single")
            }
            className="px-4 py-2 bg-blue-600 text-text-skin-base rounded-lg hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 transition-colors duration-200 text-sm font-medium"
          >
            {viewMode === "single" ? "Show All" : "Show Single"}
          </button>

          {/* Prev / Next Buttons */}
          {viewMode === "single" && (
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={prevSubmission}
                className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              </button>
              <button
                type="button"
                onClick={nextSubmission}
                className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
              >
                <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Submissions */}
      {submissions.length > 0 && (
        <div className="space-y-4">
          {viewMode === "single" ? (
            <SubmissionCard
              submission={submissions[selectedSubmissionIndex]}
              fields={section.fields}
              submissionIndex={selectedSubmissionIndex}
              totalSubmissions={section.submission.length}
              allSections={allSections}
            />
          ) : (
            submissions.map((submission, index) => (
              <SubmissionCard
                key={index}
                submission={submission}
                fields={section.fields}
                submissionIndex={index}
                totalSubmissions={section.submission.length}
                allSections={allSections}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

const FormPreview = ({ formData = [] }) => {
  if (!formData || formData.length === 0) {
    return (
      <div className="p-8 text-center text-text-skin-secondary">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p className="mt-2 text-text-skin-base">No form data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 bg-skin-card min-h-screen p-6">
      {formData.map((section, index) => {
        const submissions =
          section.submission?.filter((i) => Boolean(i.submitted_at)) || [];
        const hasMultipleSubmissions = submissions.length > 1;
        return (
          <div className="space-y-6">
            {/* Section Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <h2 className="text-2xl font-bold text-text-skin-base">
                  {section.section_name}
                </h2>
                {hasMultipleSubmissions && (
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium flex items-center">
                    <Users className="w-4 h-4 mr-1" />
                    {submissions.length} submissions
                  </span>
                )}
              </div>
              <SectionFormPreview
                key={section.section_id || index}
                section={section}
                allSections={formData}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const SectionFormPreviewWhole = ({
  section,
  allSections = [],
  submissionData = {},
}) => {
  const fieldsWithValues = section.fields
    .filter(hasValue)
    .filter((field) => isFieldVisible(field, allSections, submissionData));

  if (fieldsWithValues.length === 0) {
    return null;
  }
  return (
    <div key={section.section_id}>
      <h3 className="text-base font-bold text-text-skin-base mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
        {section.section_name}
      </h3>

      <Row gutter={[20, 20]}>
        {fieldsWithValues.map((field) => (
          <Col key={field.field_id || field.name} {...getFieldSpan(field)}>
            {/* Label - Same style as form */}
            <div className="mb-1">
              <span className="text-text-skin-base font-medium text-base">
                {field.label}
              </span>
              {field.required && (
                <span className="text-red-500 ml-1">*</span>
              )}
            </div>
            {/* Value - Displayed like disabled input */}
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-md min-h-[40px]">
              {renderFieldValue(field)}
            </div>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default FormPreview;
