import { useEffect, useState } from "react";
import { Table, Empty, Tabs, Card, NxFileText } from "@nexgensis/core";
import { FileTextOutlined } from "@ant-design/icons";

import { getSupplierFormData } from "@/apps/DynamicFormApp/api/form_apis";
import {
  getSectionIcon,
  getSectionTableColumns,
  prepareTableData,
  renderFieldValue,
} from "./constants";

const { TabPane } = Tabs;

const NCDetails = ({ ticketId }) => {
  const [supplierData, setSupplierData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeStageKey, setActiveStageKey] = useState(null);

  const fetchSupplierData = async (id) => {
    setLoading(true);
    getSupplierFormData(
      ({ data }) => {
        if (data?.status === "success") {
          setSupplierData(data);
          // Set the first stage as active by default
          if (data.stages && data.stages.length > 0) {
            setActiveStageKey(data.stages[0].name);
          }
        }
        setLoading(false);
      },
      { ticket_id: id },
      null, // signal
      null, // onError
      { suppressToast: true } // Don't show toast if stages not configured
    );
  };

  useEffect(() => {
    if (ticketId) {
      fetchSupplierData(ticketId);
    }
  }, [ticketId]);

  if (!supplierData || !supplierData.stages) {
    return (
      <div className="flex justify-center items-center h-64">
        <Empty description="No audit data available" />
      </div>
    );
  }

  // Prepare stage tabs
  const stageTabs = supplierData.stages.map((stage) => ({
    key: stage.name,
    label: (
      <span className="flex items-center">
        <FileTextOutlined className="mr-2" />
        {stage.name}
      </span>
    ),
    children: (
      <div className="mt-4">
        {stage.data && stage.data.length > 0 ? (
          stage.data.map((form, formIndex) => (
            <Card
              key={`${stage.name}-${form.form_id || formIndex}-${formIndex}`}
              className="mb-6 shadow-sm"
              title={
                <div className="flex items-center">
                  <FileTextOutlined className="text-blue-600 mr-2" />
                  <span className="font-semibold">
                    {form.form_name || "Unknown Form"}
                  </span>
                </div>
              }
            >
              {form.sections && form.sections.length > 0 ? (
                <Tabs
                  defaultActiveKey={
                    form.sections[0]?.section_id?.toString() || "0"
                  }
                  type="card"
                  size="small"
                  data-testid="nc-details-sections-tabs"
                >
                  {form.sections.map((section, sectionIndex) => (
                    <TabPane
                      tab={
                        <span className="flex items-center">
                          {getSectionIcon(section.section_name)}
                          <span className="ml-2">
                            {section.section_name ||
                              `Section ${sectionIndex + 1}`}
                          </span>
                        </span>
                      }
                      key={section.section_id || sectionIndex}
                    >
                      <div className="p-4">
                        <div>
                          {/* Render table fields directly */}
                          {section.fields
                            ?.filter((field) => field.type === "Table")
                            .map((field, fieldIndex) => (
                              <div key={fieldIndex} className="mb-6">
                                <h4 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-100">
                                  {field.label}
                                </h4>
                                {renderFieldValue(
                                  field.value,
                                  field.type,
                                  field.label
                                )}
                              </div>
                            ))}

                          {/* Render non-table fields in a regular table */}
                          {section.fields?.some(
                            (field) => field.type !== "Table"
                          ) && (
                            <Table
                              columns={getSectionTableColumns(section)}
                              dataSource={prepareTableData(section).filter(
                                (row) => row.fieldType !== "Table"
                              )}
                              loading={loading}
                              scroll={{ x: 1300, y: "calc(100vh - 400px)" }}
                              pagination={{
                                total: prepareTableData(section).filter(
                                  (row) => row.fieldType !== "Table"
                                ).length,
                                pageSize: 15,
                                showSizeChanger: true,
                                showQuickJumper: true,
                                showTotal: (total, range) =>
                                  `${range[0]}-${range[1]} of ${total} items`,
                              }}
                              className="audit-table"
                              size="small"
                              rowClassName={(record) => {
                                if (
                                  record.isCompliant === false &&
                                  record.severity === "High"
                                ) {
                                  return "bg-red-50 border-l-4 border-red-400";
                                }
                                if (record.needsAction === true) {
                                  return "bg-orange-50 border-l-4 border-orange-400";
                                }
                                if (record.isCompliant === true) {
                                  return "bg-green-50 border-l-4 border-green-400";
                                }
                                return "";
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </TabPane>
                  ))}
                </Tabs>
              ) : (
                <Empty description="No sections available" />
              )}
            </Card>
          ))
        ) : (
          <Empty description="No forms available" />
        )}
      </div>
    ),
  }));

  return (
    <div className="w-full mx-auto mt-2 px-4">
      <Tabs
        activeKey={activeStageKey}
        onChange={setActiveStageKey}
        type="card"
        size="large"
        items={stageTabs}
        data-testid="nc-details-stage-tabs"
      />
    </div>
  );
};

export default NCDetails;
