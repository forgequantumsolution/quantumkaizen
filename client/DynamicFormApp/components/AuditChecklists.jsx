import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import {
  Table,
  Button,
  Form,
  Input,
  Space,
  Toast,
  Popconfirm,
  Empty,
  Tooltip,
  Collapse,
  Tag,
  Divider,
  Modal,
} from "@nexgensis/core";
import {
  NxPlus,
  NxTrash2,
  NxEdit2,
  NxEye,
  NxArrowLeft,
  NxMaximize2,
} from "@nexgensis/core";
import { useTranslation } from "react-i18next";
import {
  get_complete_iso_standards,
  add_iso_standard,
  update_iso_standard,
  delete_iso_standard,
} from "../api/dynamic-form-api";

const { TextArea } = Input;

const AuditChecklists = forwardRef(({ searchText = "" }, ref) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [checklists, setChecklists] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  // Page view states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [form] = Form.useForm();

  // Clauses state for the form
  const [clauses, setClauses] = useState([]);

  // Requirement detail modal state
  const [requirementModal, setRequirementModal] = useState({
    open: false,
    clauseIndex: null,
    scIndex: null,
    title: "",
    text: "",
  });

  // Fetch checklists
  const fetchChecklists = useCallback(() => {
    setLoading(true);
    const params = {
      page: pagination.current,
      page_size: pagination.pageSize,
    };

    if (searchText?.trim()) {
      params.search = searchText.trim();
    }

    get_complete_iso_standards(
      (res) => {
        const responseData = res?.data || res || {};
        const data = responseData?.data || [];
        const totalCount = responseData?.pagination?.total_items || data.length || 0;

        setChecklists(Array.isArray(data) ? data : []);
        setPagination((prev) => ({
          ...prev,
          total: totalCount,
        }));
        setLoading(false);
      },
      params
    );
  }, [pagination.current, pagination.pageSize, searchText]);

  useEffect(() => {
    fetchChecklists();
  }, [fetchChecklists]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, [searchText]);

  // Handle open form for create
  const handleCreate = () => {
    setEditingChecklist(null);
    setIsViewMode(false);
    setClauses([{
      clause_number: "",
      clause_title: "",
      sub_clauses: [{ sub_clause_number: "", sub_clause_title: "", requirement_text: "" }]
    }]);
    form.resetFields();
    setIsFormOpen(true);
  };

  // Handle open form for edit
  const handleEdit = (record) => {
    setEditingChecklist(record);
    setIsViewMode(false);
    form.setFieldsValue({
      name: record.name,
      remarks: record.remarks,
    });
    // Load existing clauses
    if (record.clauses && record.clauses.length > 0) {
      setClauses(record.clauses.map(clause => ({
        id: clause.id,
        clause_number: clause.clause_number,
        clause_title: clause.clause_title || "",
        sub_clauses: clause.sub_clauses && clause.sub_clauses.length > 0
          ? clause.sub_clauses.map(sc => ({
              id: sc.id,
              sub_clause_number: sc.sub_clause_number || "",
              sub_clause_title: sc.sub_clause_title || "",
              requirement_text: sc.requirement_text || ""
            }))
          : [{ sub_clause_number: "", sub_clause_title: "", requirement_text: "" }]
      })));
    } else {
      setClauses([{
        clause_number: "",
        clause_title: "",
        sub_clauses: [{ sub_clause_number: "", sub_clause_title: "", requirement_text: "" }]
      }]);
    }
    setIsFormOpen(true);
  };

  // Handle open form for view
  const handleView = (record) => {
    setEditingChecklist(record);
    setIsViewMode(true);
    form.setFieldsValue({
      name: record.name,
      remarks: record.remarks,
    });
    // Load existing clauses for viewing
    if (record.clauses && record.clauses.length > 0) {
      setClauses(record.clauses.map(clause => ({
        id: clause.id,
        clause_number: clause.clause_number,
        clause_title: clause.clause_title || "",
        sub_clauses: clause.sub_clauses && clause.sub_clauses.length > 0
          ? clause.sub_clauses.map(sc => ({
              id: sc.id,
              sub_clause_number: sc.sub_clause_number || "",
              sub_clause_title: sc.sub_clause_title || "",
              requirement_text: sc.requirement_text || ""
            }))
          : []
      })));
    } else {
      setClauses([]);
    }
    setIsFormOpen(true);
  };

  // Handle delete
  const handleDelete = async (record) => {
    try {
      const res = await delete_iso_standard(record.id);
      if (res?.status === "failed") {
        Toast.error(res?.message || t("Failed to delete checklist"));
      } else {
        Toast.success(res?.message || t("Checklist deleted successfully"));
        fetchChecklists();
      }
    } catch (error) {
      Toast.error(error?.message || t("Failed to delete checklist"));
    }
  };

  // Handle back to list
  const handleBack = () => {
    setIsFormOpen(false);
    setEditingChecklist(null);
    setIsViewMode(false);
    setClauses([]);
    form.resetFields();
  };

  // Clause management - add new clause at top so user doesn't need to scroll
  const addClause = () => {
    setClauses([{
      clause_number: "",
      clause_title: "",
      sub_clauses: [{ sub_clause_number: "", sub_clause_title: "", requirement_text: "" }]
    }, ...clauses]);
  };

  const removeClause = (clauseIndex) => {
    if (clauses.length > 1) {
      setClauses(clauses.filter((_, idx) => idx !== clauseIndex));
    }
  };

  const updateClauseField = (clauseIndex, field, value) => {
    const updated = [...clauses];
    updated[clauseIndex][field] = value;
    setClauses(updated);
  };

  // Sub-clause management - add new sub-clause at top so user doesn't need to scroll
  const addSubClause = (clauseIndex) => {
    const updated = [...clauses];
    updated[clauseIndex].sub_clauses = [
      { sub_clause_number: "", sub_clause_title: "", requirement_text: "" },
      ...updated[clauseIndex].sub_clauses
    ];
    setClauses(updated);
  };

  const removeSubClause = (clauseIndex, subClauseIndex) => {
    const updated = [...clauses];
    if (updated[clauseIndex].sub_clauses.length > 1) {
      updated[clauseIndex].sub_clauses = updated[clauseIndex].sub_clauses.filter((_, idx) => idx !== subClauseIndex);
      setClauses(updated);
    }
  };

  const updateSubClauseField = (clauseIndex, subClauseIndex, field, value) => {
    const updated = [...clauses];
    updated[clauseIndex].sub_clauses[subClauseIndex][field] = value;
    setClauses(updated);
  };

  // Handle form submit
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // Validate clauses
      const validClauses = clauses.filter(c => c.clause_number.trim() !== "");
      if (validClauses.length === 0) {
        Toast.error(t("Please add at least one clause"));
        return;
      }

      const payload = {
        name: values.name,
        remarks: values.remarks || "",
        clauses: validClauses.map(clause => ({
          ...(clause.id && { id: clause.id }),
          clause_number: clause.clause_number,
          clause_title: clause.clause_title || "",
          sub_clauses: clause.sub_clauses
            .filter(sc => sc.sub_clause_number.trim() !== "" || sc.requirement_text.trim() !== "")
            .map(sc => ({
              ...(sc.id && { id: sc.id }),
              sub_clause_number: sc.sub_clause_number,
              sub_clause_title: sc.sub_clause_title || "",
              requirement_text: sc.requirement_text
            }))
        }))
      };

      setSubmitting(true);

      if (editingChecklist) {
        update_iso_standard(
          (res) => {
            setSubmitting(false);
            if (res?.status === "failed") {
              Toast.error(res?.message || t("Failed to update checklist"));
            } else {
              Toast.success(res?.message || t("Checklist updated successfully"));
              handleBack();
              fetchChecklists();
            }
          },
          payload,
          editingChecklist.id
        );
      } else {
        add_iso_standard((res) => {
          setSubmitting(false);
          if (res?.status === "failed") {
            Toast.error(res?.message || t("Failed to create checklist"));
          } else {
            Toast.success(res?.message || t("Checklist created successfully"));
            handleBack();
            fetchChecklists();
          }
        }, payload);
      }
    } catch (error) {
      setSubmitting(false);
      Toast.error(error?.message || t("Please fill all required fields"));
    }
  };

  // Calculate total sub-clauses count
  const getTotalSubClausesCount = (clausesList) => {
    if (!clausesList || !Array.isArray(clausesList)) return 0;
    return clausesList.reduce((total, clause) => total + (clause.sub_clauses_count || clause.sub_clauses?.length || 0), 0);
  };

  // Table columns
  const columns = [
    {
      title: <span className="font-bold">#</span>,
      key: "index",
      width: 60,
      align: "center",
      render: (_, __, index) => (
        <span className="text-gray-600 font-semibold">
          {(pagination.current - 1) * pagination.pageSize + index + 1}
        </span>
      ),
    },
    {
      title: <span className="font-bold">{t("Name")}</span>,
      dataIndex: "name",
      key: "name",
      width: 250,
      render: (text) => (
        <span className="font-semibold text-gray-900 dark:text-gray-100">{text}</span>
      ),
    },
    {
      title: <span className="font-bold">{t("Remarks")}</span>,
      dataIndex: "remarks",
      key: "remarks",
      width: 250,
      render: (text) => (
        <span className="text-gray-600 dark:text-gray-400">{text || "-"}</span>
      ),
    },
    {
      title: <span className="font-bold">{t("Clauses")}</span>,
      dataIndex: "clauses_count",
      key: "clauses_count",
      width: 100,
      align: "center",
      render: (count) => (
        <Tag color="blue">{count || 0}</Tag>
      ),
    },
    {
      title: <span className="font-bold">{t("Actions")}</span>,
      key: "actions",
      width: 150,
      align: "center",
      fixed: "right",
      render: (_, record) => (
        <Space size="small">
          <Tooltip title={t("View")}>
            <Button
              type="text"
              size="small"
              icon={<NxEye size={16} className="text-blue-500" />}
              onClick={() => handleView(record)}
            />
          </Tooltip>
          <Tooltip title={t("Edit")}>
            <Button
              type="text"
              size="small"
              icon={<NxEdit2 size={16} className="text-emerald-500" />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title={t("Delete Checklist")}
            description={t("Are you sure you want to delete this checklist?")}
            onConfirm={() => handleDelete(record)}
            okText={t("Yes")}
            cancelText={t("No")}
          >
            <Tooltip title={t("Delete")}>
              <Button
                type="text"
                size="small"
                danger
                icon={<NxTrash2 size={16} />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    fetchChecklists,
    handleCreate,
  }));

  // Render form page
  if (isFormOpen) {
    return (
      <div className="p-1">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <Button
              type="text"
              icon={<NxArrowLeft size={20} />}
              onClick={handleBack}
              className="!p-2"
            />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 m-0">
                {isViewMode
                  ? t("View Checklist")
                  : editingChecklist
                  ? t("Edit Checklist")
                  : t("Create Checklist")}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 m-0 mt-1">
                {isViewMode
                  ? t("View checklist details with clauses and questions")
                  : t("Add checklist with clauses and questions")}
              </p>
            </div>
          </div>
          {!isViewMode && (
            <Space>
              <Button onClick={handleBack}>{t("Cancel")}</Button>
              <Button type="primary" onClick={handleSubmit} loading={submitting}>
                {editingChecklist ? t("Update") : t("Create")}
              </Button>
            </Space>
          )}
          {isViewMode && (
            <Button onClick={handleBack}>{t("Back to List")}</Button>
          )}
        </div>

        {/* Form Content */}
        <div className="w-full max-h-[calc(100vh-250px)] overflow-y-auto pr-2">
          <Form form={form} layout="vertical">
            {/* Section 1: Checklist Information */}
            <Collapse
              defaultActiveKey={["checklist-info"]}
              className="mb-6 [&_.ant-collapse-item]:border [&_.ant-collapse-item]:border-gray-200 [&_.ant-collapse-item]:dark:border-gray-700 [&_.ant-collapse-item]:rounded-lg [&_.ant-collapse-item]:overflow-hidden [&_.ant-collapse-content]:border-t [&_.ant-collapse-content]:border-gray-200 [&_.ant-collapse-content]:dark:border-gray-700 bg-transparent border-0"
            >
              <Collapse.Panel
                key="checklist-info"
                header={
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 m-0 flex items-center gap-2">
                    <span className="w-1 h-5 bg-blue-600 rounded-full"></span>
                    {t("Checklist Information")}
                  </h3>
                }
              >
                <Form.Item
                  name="name"
                  label={<span className="font-semibold">{t("Checklist Name")} <span className="text-red-500">*</span></span>}
                  rules={[{ required: true, message: t("Please enter checklist name") }]}
                >
                  <Input
                    placeholder={t("e.g., ISO 9001:2015")}
                    disabled={isViewMode}
                    size="large"
                  />
                </Form.Item>

                <Form.Item
                  name="remarks"
                  label={<span className="font-semibold">{t("Remarks")}</span>}
                  className="mb-0"
                >
                  <TextArea
                    rows={2}
                    placeholder={t("Enter any remarks or notes...")}
                    disabled={isViewMode}
                  />
                </Form.Item>
              </Collapse.Panel>
            </Collapse>

            {/* Section 2: Clauses & Sub-Clauses */}
            <Collapse
              defaultActiveKey={["clauses-section"]}
              className="mb-6 [&_.ant-collapse-item]:border [&_.ant-collapse-item]:border-gray-200 [&_.ant-collapse-item]:dark:border-gray-700 [&_.ant-collapse-item]:rounded-lg [&_.ant-collapse-item]:overflow-hidden [&_.ant-collapse-content]:border-t [&_.ant-collapse-content]:border-gray-200 [&_.ant-collapse-content]:dark:border-gray-700 bg-transparent border-0"
            >
              <Collapse.Panel
                key="clauses-section"
                header={
                  <div className="flex items-center justify-between w-full">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 m-0 flex items-center gap-2">
                      <span className="w-1 h-5 bg-blue-600 rounded-full"></span>
                      {t("Clauses & Sub-Clauses")}
                      <Tag color="blue" className="ml-2">{clauses.length} {t("clauses")}</Tag>
                    </h3>
                    {!isViewMode && (
                      <Button
                        type="primary"
                        size="small"
                        icon={<NxPlus size={14} />}
                        onClick={(e) => {
                          e.stopPropagation();
                          addClause();
                        }}
                      >
                        {t("Add Clause")}
                      </Button>
                    )}
                  </div>
                }
              >
                <Table
                  dataSource={clauses.map((c, i) => ({ ...c, _index: i }))}
                  rowKey="_index"
                  pagination={false}
                  size="small"
                  expandable={{
                    expandedRowRender: (record) => {
                      const clauseIndex = record._index;
                      const clause = clauses[clauseIndex];
                      return (
                        <div className="py-2">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                              {t("Sub-Clauses")} ({clause.sub_clauses.length})
                            </span>
                            {!isViewMode && (
                              <Button
                                type="link"
                                size="small"
                                icon={<NxPlus size={12} />}
                                onClick={() => addSubClause(clauseIndex)}
                              >
                                {t("Add Sub-Clause")}
                              </Button>
                            )}
                          </div>
                          <Table
                            dataSource={clause.sub_clauses.map((sc, i) => ({ ...sc, _scIndex: i }))}
                            rowKey="_scIndex"
                            pagination={false}
                            size="small"
                            showHeader={true}
                            columns={[
                              {
                                title: <span className="text-xs font-semibold">{t("No.")}</span>,
                                width: 140,
                                render: (_, scRecord) => (
                                  <Input
                                    placeholder={t("e.g., 4.1")}
                                    value={scRecord.sub_clause_number}
                                    onChange={(e) => updateSubClauseField(clauseIndex, scRecord._scIndex, "sub_clause_number", e.target.value)}
                                    disabled={isViewMode}
                                    size="small"
                                  />
                                ),
                              },
                              {
                                title: <span className="text-xs font-semibold">{t("Title")}</span>,
                                width: 280,
                                render: (_, scRecord) => (
                                  <Input
                                    placeholder={t("Sub-Clause Title")}
                                    value={scRecord.sub_clause_title}
                                    onChange={(e) => updateSubClauseField(clauseIndex, scRecord._scIndex, "sub_clause_title", e.target.value)}
                                    disabled={isViewMode}
                                    size="small"
                                  />
                                ),
                              },
                              {
                                title: <span className="text-xs font-semibold">{t("Requirement")}</span>,
                                render: (_, scRecord) => (
                                  <div className="flex items-center gap-1">
                                    <TextArea
                                      placeholder={t("Requirement text...")}
                                      value={scRecord.requirement_text}
                                      onChange={(e) => updateSubClauseField(clauseIndex, scRecord._scIndex, "requirement_text", e.target.value)}
                                      disabled={isViewMode}
                                      autoSize={{ minRows: 1, maxRows: 3 }}
                                      className="text-xs!"
                                    />
                                    <Tooltip title={t("Expand")}>
                                      <Button
                                        type="text"
                                        size="small"
                                        icon={<NxMaximize2 size={13} />}
                                        className="shrink-0 text-blue-500"
                                        onClick={() => setRequirementModal({
                                          open: true,
                                          clauseIndex,
                                          scIndex: scRecord._scIndex,
                                          title: `${scRecord.sub_clause_number || ""} ${scRecord.sub_clause_title || ""}`.trim(),
                                          text: scRecord.requirement_text || "",
                                        })}
                                      />
                                    </Tooltip>
                                  </div>
                                ),
                              },
                              ...(!isViewMode ? [{
                                title: "",
                                width: 50,
                                align: "center",
                                render: (_, scRecord) => clause.sub_clauses.length > 1 ? (
                                  <Tooltip title={t("Remove")}>
                                    <Button
                                      type="text"
                                      danger
                                      size="small"
                                      icon={<NxTrash2 size={13} />}
                                      onClick={() => removeSubClause(clauseIndex, scRecord._scIndex)}
                                    />
                                  </Tooltip>
                                ) : null,
                              }] : []),
                            ]}
                            className="[&_.ant-table-thead>tr>th]:bg-gray-50 [&_.ant-table-thead>tr>th]:dark:bg-gray-800 [&_.ant-table-thead>tr>th]:py-1"
                          />
                        </div>
                      );
                    },
                  }}
                  columns={[
                    {
                      title: <span className="font-semibold text-xs">{t("Clause No.")}</span>,
                      width: 130,
                      render: (_, record) => (
                        <Input
                          placeholder={t("e.g., 4")}
                          value={record.clause_number}
                          onChange={(e) => updateClauseField(record._index, "clause_number", e.target.value)}
                          disabled={isViewMode}
                          size="small"
                          className="font-semibold"
                        />
                      ),
                    },
                    {
                      title: <span className="font-semibold text-xs">{t("Clause Title")}</span>,
                      render: (_, record) => (
                        <Input
                          placeholder={t("e.g., Context of the organization")}
                          value={record.clause_title}
                          onChange={(e) => updateClauseField(record._index, "clause_title", e.target.value)}
                          disabled={isViewMode}
                          size="small"
                        />
                      ),
                    },
                    {
                      title: <span className="font-semibold text-xs">{t("Sub-Clauses")}</span>,
                      width: 110,
                      align: "center",
                      render: (_, record) => (
                        <Tag color="blue">{record.sub_clauses.length}</Tag>
                      ),
                    },
                    ...(!isViewMode ? [{
                      title: "",
                      width: 50,
                      align: "center",
                      render: (_, record) => clauses.length > 1 ? (
                        <Tooltip title={t("Remove Clause")}>
                          <Button
                            type="text"
                            danger
                            size="small"
                            icon={<NxTrash2 size={14} />}
                            onClick={() => removeClause(record._index)}
                          />
                        </Tooltip>
                      ) : null,
                    }] : []),
                  ]}
                  className="[&_.ant-table-thead>tr>th]:bg-gray-50 [&_.ant-table-thead>tr>th]:dark:bg-gray-900"
                />
              </Collapse.Panel>
            </Collapse>
          </Form>
        </div>

        {/* Requirement Detail Modal */}
        <Modal
          title={
            <div className="flex items-center gap-2">
              <span className="w-1 h-5 bg-blue-600 rounded-full"></span>
              <span>{requirementModal.title || t("Requirement Details")}</span>
            </div>
          }
          open={requirementModal.open}
          onCancel={() => setRequirementModal((prev) => ({ ...prev, open: false }))}
          footer={isViewMode ? [
            <Button key="close" onClick={() => setRequirementModal((prev) => ({ ...prev, open: false }))}>
              {t("Close")}
            </Button>
          ] : [
            <Button key="cancel" onClick={() => setRequirementModal((prev) => ({ ...prev, open: false }))}>
              {t("Cancel")}
            </Button>,
            <Button
              key="save"
              type="primary"
              onClick={() => {
                updateSubClauseField(requirementModal.clauseIndex, requirementModal.scIndex, "requirement_text", requirementModal.text);
                setRequirementModal((prev) => ({ ...prev, open: false }));
              }}
            >
              {t("Save")}
            </Button>,
          ]}
          width="85vw"
          style={{ maxWidth: 1100, top: 30 }}
          styles={{ body: { height: "70vh", overflow: "auto" } }}
        >
          <div className="py-2 h-full">
            <TextArea
              value={requirementModal.text}
              onChange={(e) => setRequirementModal((prev) => ({ ...prev, text: e.target.value }))}
              disabled={isViewMode}
              style={{ height: "calc(70vh - 40px)", resize: "none" }}
              placeholder={t("Requirement text...")}
            />
          </div>
        </Modal>
      </div>
    );
  }

  // Render table list view
  return (
    <div className="p-1">
      <Table
        dataSource={checklists}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: (total, range) => (
            <span className="text-gray-500">
              {range[0]}-{range[1]} {t("of")} {total} {t("items")}
            </span>
          ),
          onChange: (page, pageSize) => {
            setPagination({ ...pagination, current: page, pageSize });
          },
        }}
        scroll={{ x: 900 }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span className="text-gray-400">{t("No checklists found")}</span>
              }
            />
          ),
        }}
        className="[&_.ant-table-thead>tr>th]:bg-gray-50 [&_.ant-table-thead>tr>th]:dark:bg-gray-900 [&_.ant-table-thead>tr>th]:font-bold"
      />
    </div>
  );
});

export default AuditChecklists;
