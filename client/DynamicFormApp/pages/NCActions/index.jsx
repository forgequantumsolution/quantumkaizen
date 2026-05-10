import React, { useEffect, useState } from "react";
import { Card, Modal, Typography, Button, Tag, Divider, NxEye, NxAlertCircle, NxAlertTriangle, NxCheckCircle, NxFileSearch, NxFile, NxX, Toast } from "@nexgensis/core";
import { create_subtickets, get_nc_suggestions } from "@/apps/DynamicFormApp/api/form_apis";
import { get_file_upload } from "@/utils/api";

const { Text, Title } = Typography;

const NCActions = ({ ticketId }) => {
  const [selectedSection, setSelectedSection] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [ncData, setNcData] = useState([]);

  const success_get_nc_suggestions = ({ data }) => {
    if (data.status === "success") {
      setNcData(data);
    } else {
      Toast.error(data.msg);
    }
  };

  useEffect(() => {
    if (ticketId) {
      const params = { ticket_id: ticketId };
      get_nc_suggestions(success_get_nc_suggestions, params);
    }
  }, [ticketId]);

  const openModal = (section) => {
    setSelectedSection(section);
    setModalVisible(true);
  };

  const handleCreateTicket = (issue) => {
    const data = {
      parent_ticket: ticketId,
      section_label: issue.subtype,
      fields: issue.flagged_fields || [],
    };
    create_subtickets(data, (data, error) => {
      if (data && data.status === "success") {
        Toast.success(data?.msg);
        get_nc_suggestions(success_get_nc_suggestions, { ticket_id: ticketId });
        setModalVisible(false);
      }
      if (error) {
        Toast.error(error.msg);
      }
    });
  };

  const handleIgnoreProcess = (issue) => {
    // TODO: Implement ignore process API call
    Toast.info(`Ignoring process for ${issue.subtype}`);
    // Add your ignore process logic here
  };

  const handleViewFile = (fileId) => {
    get_file_upload((res) => {
      if (res.status === 200) {
        window.open(res.data.file_url, "_blank", "noopener,noreferrer");
      }
    }, fileId);
  };

  const renderFieldValue = (field) => {
    const { label, type, value } = field;

    switch (type) {
      case "File Upload":
        if (value && typeof value === "object" && value.file_id) {
          return (
            <div className="flex items-center gap-3">
              <Button
                type="default"
                size="small"
                icon={<FileOutlined />}
                onClick={() => handleViewFile(value.file_id)}
                className="dark:bg-blue-600 dark:text-white bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"
              >
                {value.file_name}
              </Button>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {Math.round(value.file_size / 1024)} KB
                {value.is_expired && (
                  <span className="text-red-500 ml-1">(Expired)</span>
                )}
              </span>
            </div>
          );
        }
        return (
          <Text type="secondary" className="text-sm">
            No file uploaded
          </Text>
        );

      case "Textarea":
        return (
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
            <Text className="text-sm dark:text-gray-200 whitespace-pre-wrap">
              {String(value || "No content")}
            </Text>
          </div>
        );

      case "Select":
        if (value && typeof value === "object" && value.label) {
          return (
            <Tag
              color={
                value.value === "High"
                  ? "red"
                  : value.value === "Medium"
                    ? "orange"
                    : value.value === "Low"
                      ? "green"
                      : "default"
              }
              className="px-2 py-1"
            >
              {value.label}
            </Tag>
          );
        }
        return (
          <Tag
            color={
              value === "Major NC"
                ? "red"
                : value === "Minor NC"
                  ? "orange"
                  : value === "Compliant"
                    ? "green"
                    : "default"
            }
            className="px-2 py-1"
          >
            {String(value || "Not selected")}
          </Tag>
        );

      default:
        if (Array.isArray(value)) {
          if (
            label === "Evidence Attachments" ||
            label === "Evidence Documents"
          ) {
            return (
              <div className="flex flex-wrap gap-2">
                {value.map((file, index) => (
                  <Button
                    key={file.file_id || index}
                    type="default"
                    size="small"
                    icon={<FileOutlined />}
                    onClick={() => handleViewFile(file.file_id)}
                    className="dark:bg-blue-600 dark:text-white bg-blue-50 text-blue-600 border-blue-200"
                  >
                    {file.file_name}
                  </Button>
                ))}
              </div>
            );
          }
          return <Text className="text-sm">{value.join(", ")}</Text>;
        }

        if (typeof value === "boolean") {
          return (
            <Tag color={value ? "green" : "red"} size="small">
              {value ? "Yes" : "No"}
            </Tag>
          );
        }

        if (typeof value === "object" && value !== null) {
          return (
            <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded text-xs font-mono max-w-md overflow-auto">
              {JSON.stringify(value, null, 2)}
            </div>
          );
        }

        return (
          <Text className="text-sm dark:text-gray-200">
            {String(value || "Not specified")}
          </Text>
        );
    }
  };

  if (ncData && ncData?.sections?.length <= 0) {
    return (
      <div className="bg-yellow-500 dark:bg-yellow-600 rounded-md p-5">
        <p className="text-white font-bold">{ncData?.msg}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 p-4">
      {ncData?.sections?.map((section, index) => (
        <Card
          key={index}
          className="shadow-lg rounded-2xl border border-gray-400 dark:border-gray-600 hover:shadow-xl transition duration-200 h-full dark:bg-gray-800"
          styles={{ body: { height: "100%" } }}
        >
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <Title level={5} className="m-0 text-gray-900 dark:text-gray-100">
                {section.section_name}
              </Title>
              {section.non_compliant_count > 0 && (
                <Tag
                  color="red"
                  className="text-xs font-medium px-2 py-1 dark:text-red-400 dark:bg-red-900/40"
                >
                  <WarningOutlined className="mr-1" />
                  {section.non_compliant_count} Issues
                </Tag>
              )}
            </div>

            <div className="mt-3 space-y-1 text-sm text-gray-700 dark:text-gray-200">
              <p>
                <CheckCircleOutlined className="text-green-500 dark:text-green-400 mr-2" />
                {section.compliant_count} Compliant
              </p>
              <p>
                <WarningOutlined className="text-red-500 dark:text-red-400 mr-2" />
                {section.non_compliant_count} Non-Compliant
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-xs">
                {section?.issues?.length} sections • {section?.issues?.length}{" "}
                total items
              </p>
              {section.high_severity_count > 0 && (
                <p className="text-red-600 dark:text-red-400 font-semibold text-sm">
                  {section.high_severity_count} high severity issues
                </p>
              )}
            </div>

            <Button
              icon={<EyeOutlined />}
              className="w-full mt-auto dark:bg-gray-700 dark:text-gray-200"
              type="default"
              onClick={() => openModal(section)}
            >
              View Details
            </Button>
          </div>
        </Card>
      ))}

      {/* Compact Centered Modal */}
      <Modal
        open={modalVisible}
        title={
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <ExclamationCircleOutlined className="text-yellow-500 mr-2" />
              <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {selectedSection?.section_name}
              </span>
            </div>
            <Button
              type="text"
              icon={<CloseOutlined />}
              onClick={() => setModalVisible(false)}
              className="dark:text-gray-400 hover:dark:text-gray-200"
              size="small"
            />
          </div>
        }
        closable={false}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={700}
        centered
        destroyOnClose
        styles={{
          body: {
            maxHeight: "60vh",
            overflowY: "auto",
          },
        }}
        className="dark:bg-gray-900"
      >
        {selectedSection?.issues?.length > 0 ? (
          <div className="space-y-5 border rounded-md p-4 bg-white dark:bg-gray-800">
            {selectedSection?.issues?.map((issue, idx) => (
              <div
                key={idx}
                className="pb-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
              >
                {/* Issue Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center flex-1">
                    <FileSearchOutlined className="text-blue-500 mr-2 mt-1" />
                    <div className="flex-1">
                      <Title
                        level={5}
                        className="m-0 text-gray-900 dark:text-gray-100 mb-1"
                      >
                        {issue.subtype}
                      </Title>
                      <Text
                        type="secondary"
                        className="text-sm dark:text-gray-400"
                      >
                        {selectedSection.issues.length > 1 &&
                          `${idx + 1} of ${selectedSection.issues.length}`}
                      </Text>
                    </div>
                  </div>
                  <div className="ml-4">
                    {issue.can_create_ticket &&
                    issue.ticket_status === "Not Created" ? (
                      <div className="flex gap-2">
                        <Button
                          type="primary"
                          size="small"
                          onClick={() => handleCreateTicket(issue)}
                          className="dark:bg-blue-600"
                        >
                          Create Ticket
                        </Button>
                        <Button
                          type="default"
                          size="small"
                          onClick={() => handleIgnoreProcess(issue)}
                          className="dark:bg-gray-600 dark:text-gray-200"
                        >
                          Ignore Process
                        </Button>
                      </div>
                    ) : (
                      <Tag
                        color={
                          issue.ticket_status === "In Progress"
                            ? "blue"
                            : "default"
                        }
                        className="px-2 py-1"
                      >
                        {issue.ticket_status}
                      </Tag>
                    )}
                  </div>
                </div>

                {/* Fields */}
                <div className="space-y-4">
                  {issue.flagged_fields?.map((field, fieldIndex) => (
                    <div
                      key={fieldIndex}
                      className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg"
                    >
                      <Text
                        strong
                        className="text-gray-700 dark:text-gray-300 block mb-2"
                      >
                        {field.label}
                      </Text>
                      {renderFieldValue(field)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <CheckCircleOutlined className="text-4xl text-green-500 mb-3 block" />
            <Title level={4} className="text-gray-600 dark:text-gray-400 mb-2">
              All Clear!
            </Title>
            <Text type="secondary" className="dark:text-gray-400">
              No issues found in this section.
            </Text>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default NCActions;
