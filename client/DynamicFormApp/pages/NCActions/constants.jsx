import PDFViewerModal from "@/apps/DMSApp/dms/components/DocumentViewerModal";
import { Table, Tag, Typography, Button, Space, Tooltip, NxCheckCircle, NxXCircle, NxFileText, NxShieldCheck, NxWrench, NxMapPin, NxBug, NxShield, NxSettings, NxEye } from "@nexgensis/core";
import { CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";

const { Text, Link } = Typography;

// Severity color mapping
export const getSeverityColor = (severity) => {
  const severityValue =
    typeof severity === "object" && severity?.value ? severity.value : severity;
  switch (severityValue?.toLowerCase()) {
    case "high":
      return "red";
    case "medium":
      return "orange";
    case "low":
      return "green";
    default:
      return "default";
  }
};

// Compliance status color mapping
export const getComplianceColor = (status) => {
  const statusValue =
    typeof status === "object" && status?.value ? status.value : status;
  switch (statusValue?.toLowerCase()) {
    case "compliant":
    case "minor nc":
      return "success";
    case "major nc":
    case "non-compliant":
      return "error";
    case "observation":
      return "warning";
    default:
      return "default";
  }
};

// Section icons mapping
export const getSectionIcon = (sectionName) => {
  switch (sectionName?.toLowerCase()) {
    case "safety":
      return <NxShieldCheck className="text-red-500" />;
    case "equipment":
      return <NxWrench className="text-blue-500" />;
    case "environment":
      return <NxMapPin className="text-green-500" />;
    case "quality control":
      return <NxBug className="text-purple-500" />;
    case "process":
      return <NxSettings className="text-orange-500" />;
    case "documentation":
      return <NxShield className="text-gray-500" />;
    case "findings & compliance":
      return <NxFileText className="text-blue-500" />;
    default:
      return <NxFileText className="text-gray-400" />;
  }
};

const renderTable = (value) => {
  if (!value || !Array.isArray(value) || value.length === 0) {
    return <Text type="secondary">No data</Text>;
  }

  // Dynamically extract column names from all objects in the array
  const allKeys = Array.from(
    new Set(value.flatMap((row) => Object.keys(row || {})))
  );

  // Sort keys to ensure "Parameter" comes first, then others
  const sortedKeys = allKeys.sort((a, b) => {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();

    // Parameter should come first (handle variations like "Parameter", "parameters", etc.)
    if (aLower.includes("parameter") || aLower.includes("attribute")) return -1;
    if (bLower.includes("parameter") || bLower.includes("attribute")) return 1;

    // Keep original order for other keys
    return 0;
  });

  // Define columns dynamically
  const columns = sortedKeys.map((key) => ({
    title: (
      <Text strong className="capitalize text-gray-800 dark:text-gray-100">
        {key.replace(/_/g, " ")}
      </Text>
    ),
    dataIndex: key,
    key,
    width:
      key.toLowerCase() === "remarks"
        ? 250
        : key.toLowerCase() === "description / observation"
        ? 300
        : key.toLowerCase().includes("evidence")
        ? 200
        : 150,
    render: (cellValue) => {
      // Handle file evidence fields (matches "Evidence", "Evidence (If Any)", etc.)
      if (key.toLowerCase().includes("evidence")) {
        return <div className="w-full">{renderFileEvidence(cellValue)}</div>;
      }

      // Handle compliance status fields
      if (
        key.toLowerCase().includes("compliance") ||
        key.toLowerCase().includes("status")
      ) {
        if (cellValue === "Yes" || cellValue === "Ok") {
          return (
            <Tag color="green" icon={<CheckCircleOutlined />}>
              {cellValue}
            </Tag>
          );
        } else if (cellValue === "No" || cellValue === "Not Ok") {
          return (
            <Tag color="red" icon={<CloseCircleOutlined />}>
              {cellValue}
            </Tag>
          );
        }
        return <Tag color="blue">{cellValue}</Tag>;
      }

      // Handle specific field names from your API response
      if (key === "Compliance Status" || key === "Status") {
        if (cellValue === "Yes" || cellValue === "Ok") {
          return (
            <Tag color="green" icon={<CheckCircleOutlined />}>
              {cellValue}
            </Tag>
          );
        } else if (cellValue === "No" || cellValue === "Not Ok") {
          return (
            <Tag color="red" icon={<CloseCircleOutlined />}>
              {cellValue}
            </Tag>
          );
        }
        return <Tag color="blue">{cellValue}</Tag>;
      }

      // Handle null/empty
      if (
        cellValue === null ||
        cellValue === undefined ||
        cellValue === "" ||
        (Array.isArray(cellValue) && cellValue.length === 0)
      ) {
        return <Text type="secondary">-</Text>;
      }

      // Handle objects (e.g. nested structure)
      if (typeof cellValue === "object" && !Array.isArray(cellValue)) {
        // Handle file objects (objects with file_url or file_name)
        if (cellValue.file_url || cellValue.file_name || cellValue.file_id) {
          return <div className="w-full">{renderFileEvidence(cellValue)}</div>;
        }
        if (cellValue.label) return <Text>{cellValue.label}</Text>;
        return <Text>{JSON.stringify(cellValue)}</Text>;
      }

      // Handle arrays (non-file arrays)
      if (Array.isArray(cellValue)) {
        return (
          <div className="flex flex-col gap-1">
            {cellValue.map((item, i) => (
              <Text key={i} className="text-gray-700">
                {typeof item === "string" ? item : JSON.stringify(item)}
              </Text>
            ))}
          </div>
        );
      }

      // Default: render as text with proper wrapping for long content
      return (
        <div style={{ maxWidth: "250px" }}>
          <Text className="text-gray-700 whitespace-pre-wrap break-words">
            {cellValue}
          </Text>
        </div>
      );
    },
  }));

  return (
    <div className="w-full overflow-x-auto">
      <Table
        dataSource={value.map((item, index) => ({ key: index, ...item }))}
        columns={columns}
        pagination={false}
        size="small"
        bordered
        scroll={{ x: "max-content" }}
        className="!m-0"
      />
    </div>
  );
};

// Render file evidence
export const renderFileEvidence = (files) => {
  // Handle null, undefined, or empty cases
  if (!files) {
    return <Text type="secondary">No files</Text>;
  }

  // Convert single object to array for consistent processing
  const fileArray = Array.isArray(files) ? files : [files];

  // Check if array is empty
  if (fileArray.length === 0) {
    return <Text type="secondary">No files</Text>;
  }

  // Render files with viewer
  return (
    <Space direction="vertical" size="small" className="w-full">
      {fileArray.map((file, index) => (
        <div
          key={file?.file_id || index}
          className="flex items-center gap-2 w-full"
        >
          <Tooltip
            title={`${file?.file_name || 'File'} ${file?.file_size ? `(${(file.file_size / 1024).toFixed(1)} KB)` : ''}`}
          >
            <span className="truncate text-sm text-gray-700 dark:text-gray-300 max-w-[150px]">
              {file?.file_name || 'View File'}
            </span>
          </Tooltip>
          {file?.file_url && (
            <PDFViewerModal fileUrl={file.file_url} title={file?.file_name || 'Document Viewer'} />
          )}
        </div>
      ))}
    </Space>
  );
};

// Enhanced render field value based on its type
export const renderFieldValue = (value, fieldType, label) => {
  if (value === null || value === undefined || value === "") {
    return <Text type="secondary">-</Text>;
  }

  switch (fieldType) {
    case "File Upload":
      return renderFileEvidence(value);
    case "Select":
    case "Dropdown":
      if (typeof value === "object" && value !== null && value.label) {
        // Handle compliance status with appropriate colors
        if (
          label?.toLowerCase().includes("compliance") ||
          label?.toLowerCase().includes("status")
        ) {
          return (
            <Tag
              color={getComplianceColor(value.value)}
              className="font-semibold"
            >
              {value.label}
            </Tag>
          );
        }
        // Handle severity with appropriate colors
        if (label?.toLowerCase().includes("severity")) {
          return (
            <Tag
              color={getSeverityColor(value.value)}
              className="font-semibold"
            >
              {value.label}
            </Tag>
          );
        }
        // Default select rendering
        return (
          <Tag color="blue" className="font-medium">
            {value.label}
          </Tag>
        );
      }
      return <Text>{value.toString()}</Text>;

    case "Textarea":
    case "Text":
      return (
        <div className="max-w-xs">
          <Text className="text-gray-700 dark:text-gray-300">
            {value.length > 100 ? (
              <Tooltip title={value}>
                <span>{value.substring(0, 100)}...</span>
              </Tooltip>
            ) : (
              value
            )}
          </Text>
        </div>
      );

    case "Checkbox":
    case "Boolean":
      if (typeof value === "boolean") {
        return value ? (
          <Tag color="green" icon={<CheckCircleOutlined />}>
            Yes
          </Tag>
        ) : (
          <Tag color="red" icon={<CloseCircleOutlined />}>
            No
          </Tag>
        );
      }
      break;

    case "Date":
    case "DateTime":
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return (
            <Text className="font-mono text-sm">
              {fieldType === "DateTime"
                ? date.toLocaleString()
                : date.toLocaleDateString()}
            </Text>
          );
        }
      } catch (e) {
        return <Text>{value.toString()}</Text>;
      }
      break;

    case "Number":
      return <Text className="font-mono font-medium">{value}</Text>;

    case "Email":
      return (
        <Link href={`mailto:${value}`} className="text-blue-600">
          {value}
        </Link>
      );

    case "URL":
      return (
        <Link href={value} target="_blank" className="text-blue-600">
          {value.length > 30 ? `${value.substring(0, 30)}...` : value}
        </Link>
      );

    case "Table":
      return renderTable(value);

    default:
      // Handle legacy boolean values
      if (typeof value === "boolean") {
        return value ? (
          <Tag color="green" icon={<CheckCircleOutlined />}>
            Yes
          </Tag>
        ) : (
          <Tag color="red" icon={<CloseCircleOutlined />}>
            No
          </Tag>
        );
      }

      // Handle arrays - render content instead of just count
      if (Array.isArray(value)) {
        if (value.length === 0) {
          return <Text type="secondary">None</Text>;
        }
        // Check if array contains simple strings/numbers - render them as text
        const hasSimpleValues = value.every(
          (item) => typeof item === "string" || typeof item === "number"
        );
        if (hasSimpleValues) {
          return (
            <Text className="text-gray-700 dark:text-gray-300">
              {value.join(", ")}
            </Text>
          );
        }
        // Check if array contains objects with label property
        const hasLabelObjects = value.every(
          (item) => typeof item === "object" && item !== null && item.label
        );
        if (hasLabelObjects) {
          return (
            <Text className="text-gray-700 dark:text-gray-300">
              {value.map((item) => item.label).join(", ")}
            </Text>
          );
        }
        // Fallback: render as comma-separated values
        return (
          <Text className="text-gray-700 dark:text-gray-300">
            {value.map((item) =>
              typeof item === "object" ? JSON.stringify(item) : String(item)
            ).join(", ")}
          </Text>
        );
      }

      // Handle objects with label/value structure
      if (
        typeof value === "object" &&
        value !== null &&
        value.label &&
        value.value
      ) {
        return <Text>{value.label}</Text>;
      }

      // Handle numeric values
      if (typeof value === "number" || !isNaN(Number(value))) {
        return <Text className="font-mono">{value}</Text>;
      }

      return <Text>{value.toString()}</Text>;
  }

  return <Text>{value.toString()}</Text>;
};

// Prepare table data for each section
export const prepareTableData = (section) => {
  const tableData = [];

  if (!section || !section.fields) {
    return tableData;
  }

  // Handle the new structure where fields are direct field objects
  section.fields.forEach((field, fieldIndex) => {
    if (!field || !field.label) return;

    const rowData = {
      key: `${section.section_id || "unknown"}-${field.field_id || fieldIndex}`,
      parameter: field.label,
      section: section.section_name || "Unknown Section",
      filledBy: section.submitted_by || "Unknown",
      submittedAt: section.submitted_at || new Date().toISOString(),
      role: section.role || null,
      value: field.value,
      fieldType: field.type,
      fieldId: field.field_id,
    };

    // Extract compliance and severity for row styling
    if (
      field.label?.toLowerCase().includes("compliance") ||
      field.label?.toLowerCase().includes("status")
    ) {
      const statusValue =
        typeof field.value === "object" && field.value?.value
          ? field.value.value
          : field.value;
      rowData.complianceStatus = statusValue;
    }

    if (field.label?.toLowerCase().includes("severity")) {
      const severityValue =
        typeof field.value === "object" && field.value?.value
          ? field.value.value
          : field.value;
      rowData.severity = severityValue;
    }

    tableData.push(rowData);
  });

  return tableData;
};

// Dynamic table columns for each section (excluding table fields)
export const getSectionTableColumns = (section) => {
  if (!section || !section.fields || !Array.isArray(section.fields)) {
    return [
      {
        title: "Field",
        dataIndex: "parameter",
        key: "parameter",
        width: 250,
        fixed: "left",
        render: (text) => (
          <Text strong className="text-gray-800 dark:text-gray-100">
            {text || "No Data"}
          </Text>
        ),
      },
      {
        title: "Value",
        dataIndex: "value",
        key: "value",
        width: 300,
        render: () => <Text type="secondary">No data available</Text>,
      },
    ];
  }

  // Always return Field and Value columns (table fields are handled separately)
  return [
    {
      title: "Field",
      dataIndex: "parameter",
      key: "parameter",
      width: 200,
      fixed: "left",
      render: (text) => (
        <div>
          <Text strong className="text-gray-800 dark:text-gray-100">
            {text}
          </Text>
        </div>
      ),
    },
    {
      title: "Value",
      dataIndex: "value",
      key: "value",
      width: 400,
      render: (value, record) =>
        renderFieldValue(value, record.fieldType, record.parameter),
    },
  ];
};
