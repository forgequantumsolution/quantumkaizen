  import { useEffect, useState, useCallback, useRef } from "react";
  import {
    Pagination,
    Input,
    Select,
    Button,
    Form,
    Row,
    Col,
    Modal,
    Popover,
    Tabs,
    Dropdown,
    Menu,
    Tooltip,
    Popconfirm,
    Toast,
    Checkbox,
  } from "@nexgensis/core";
  import {
    NxPlusCircle as PlusCircle,
    NxFileSearch as FileSearch,
    NxClock as Clock,
    NxCheckCircle as CheckCircle,
    NxTrash2 as Trash2,
    NxEye as Eye,
    NxEdit2 as Edit,
    NxPlus as Plus,
    NxFilter as Filter,
    NxChevronDown as ChevronDown,
    NxCloudUpload,
    NxDownload,
    NxClipboardList,
    NxLayoutGrid,
    NxNetwork,
  } from "@nexgensis/core";
  import { Formik } from "formik";
  import * as Yup from "yup";
  import {
    create_dynamic_form,
    get_checklist_type,
    get_dynamic_form,
    delete_checklist_by_id,
    export_iso_standards,
    bulk_upload_iso_standards,
  } from "../api/dynamic-form-api";
  import { useLocation, useNavigate, useSearchParams } from "react-router";
  import { addFormType, updateFormType, deleteFormType, download_forms_template, upload_forms_data, export_forms_bulk, get_main_processes, get_criteria } from "../api/form_apis";
  import { get_Locationnew } from "@/apps/ConfigurationApp/api/location-api";
  import BulkUploadFormsModal from "../components/BulkUploadFormsModal";
  import AuditChecklists from "../components/AuditChecklists";
  import { useTranslation } from "react-i18next";
  import PageWrapper from "@/components/UI/PageWrapper";
  import { useDispatch } from "react-redux";
  import { SET_LANG_DIR } from "@/store/reducers/lang_dir";
  import { get_workflow_list, get_workflow_type } from "@workflow/api/workflow_api";
  import CreateFieldGroupForm from "./CreateFieldGroupForm";
  import WorkflowsList from "@/apps/RulesEngineApp/WorkflowsList";
  import { SpellCheckInput, SpellCheckTextArea } from "@/components/SpellCheck";

  const { TextArea } = Input;

  const FormWithTabs = ({ type }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "workflow");
    const [templateSubTab, setTemplateSubTab] = useState("completed");
    const [selectedWorkflowType, setSelectedWorkflowType] = useState(null);
    const [templateInnerTab, setTemplateInnerTab] = useState("forms");
    const [workflowHeaderEl, setWorkflowHeaderEl] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [type_list, set_type_list] = useState([]);
    const [data, set_data] = useState([]);
    const [total, setTotal] = useState(0);
    const [page_number, set_page_number] = useState(1);
    const [max_rows, set_max_rows] = useState(10);
    const [loading, setLoading] = useState(false);
    const [openAddFormType, setOpenAddFormType] = useState(false);
    const [typeSubmitting, setTypeSubmitting] = useState(false);
    const [editingType, setEditingType] = useState(null);
    const [typeSelectOpen, setTypeSelectOpen] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [showCreateFieldGroup, setShowCreateFieldGroup] = useState(false);
    const [fieldGroups, setFieldGroups] = useState(() => {
      try { return JSON.parse(localStorage.getItem("field_group_templates") || "[]"); } catch { return []; }
    });
    const [workflowTypes, setWorkflowTypes] = useState([]);
    const [workflowList, setWorkflowList] = useState([]);
    const [appliedFilters, setAppliedFilters] = useState({
      form_type_id: null,
      workflow_type_id: null,
      workflow_name_id: null,
    });
    const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
    const [locationList, setLocationList] = useState([]);
    const [mainProcessList, setMainProcessList] = useState([]);
    const [criteriaList, setCriteriaList] = useState([]);

    // Checklist Templates states
    const [checklistSearchText, setChecklistSearchText] = useState("");
    const [debouncedChecklistSearch, setDebouncedChecklistSearch] = useState("");
    const [checklistExporting, setChecklistExporting] = useState(false);
    const [checklistUploading, setChecklistUploading] = useState(false);
    const checklistFileInputRef = useRef(null);
    const checklistRef = useRef(null);

    const dispatch = useDispatch();
    const debounceTimer = useRef(null);
    const checklistDebounceTimer = useRef(null);

    const location = useLocation();

    const [form] = Form.useForm();
    const { t } = useTranslation();
    const handleAddTypeCancel = () => {
      setOpenAddFormType(false);
      setEditingType(null);
      form.resetFields();
    };

    const validationSchema = Yup.object().shape({
      title: Yup.string().nullable().required(t("Title is required")),
      type_id: Yup.string().nullable().required(t("Type is required")),
      description: Yup.string().nullable().required(t("Description is required")),
    });

    const success_get_checklist_type = (res) => {
      if (res.status === 200) {
        set_type_list(res.data.data);
      }
    };

    const onAddTypeResponse = (data) => {
      setTypeSubmitting(false);
      if (data.status === "success") {
        Toast.success(data.message);
        setOpenAddFormType(false);
        setEditingType(null);
        form.resetFields();
        get_checklist_type(success_get_checklist_type);
      } else if (data.status === "failed") {
        Toast.error(data.message);
      }
    };

    const onUpdateTypeResponse = (data) => {
      setTypeSubmitting(false);
      if (data.status === "success") {
        Toast.success(data.message || t("Type updated successfully"));
        setOpenAddFormType(false);
        setEditingType(null);
        form.resetFields();
        get_checklist_type(success_get_checklist_type);
      } else if (data.status === "failed") {
        Toast.error(data.message || t("Failed to update type"));
      }
    };

    const onDeleteTypeResponse = (data) => {
      if (data.status === "success") {
        Toast.success(data.message || t("Type deleted successfully"));
        get_checklist_type(success_get_checklist_type);
      } else if (data.status === "failed") {
        Toast.error(data.message || t("Failed to delete type"));
      }
    };

    const handleEditType = (typeItem, e) => {
      e.stopPropagation();
      e.preventDefault();
      setTypeSelectOpen(false);
      setEditingType(typeItem);
      form.setFieldsValue({ name: typeItem.name });
      setOpenAddFormType(true);
    };

    const handleDeleteType = (typeItem, e) => {
      e.stopPropagation();
      deleteFormType(onDeleteTypeResponse, typeItem.id);
    };

    const handleAddTypeSubmit = async () => {
      try {
        const values = await form.validateFields();
        setTypeSubmitting(true);
        if (editingType) {
          const payload = {
            ...values,
            version_id: editingType.version_id,
          };
          updateFormType(onUpdateTypeResponse, editingType.id, payload);
        } else {
          addFormType(onAddTypeResponse, values);
        }
      } catch (err) {
        Toast.error(err?.message || t("Failed to save Type"));
        setTypeSubmitting(false);
      }
    };

    const success_get_dynamic_form = (res) => {
      if (res.status === 200) {
        // API response structure: res.data = { status, message, data: { forms, obj_count, max_rows } }
        const responseData = res.data?.data || res.data;
        set_data(responseData?.forms || []);
        set_max_rows(responseData?.max_rows || 10);
        setTotal(responseData?.obj_count || 0);
      }
      setLoading(false);
    };

    const fetchData = useCallback(() => {
      setLoading(true);
      const params = {
        is_completed: templateSubTab === "completed",
        search: searchTerm.trim() || type,
        page_number: page_number,
      };

      // Add filter params if they exist
      if (appliedFilters.form_type_id) {
        params.form_type_id = appliedFilters.form_type_id;
      }
      if (selectedWorkflowType) {
        params.workflow_type_id = selectedWorkflowType.id;
      } else if (appliedFilters.workflow_type_id) {
        params.workflow_type_id = appliedFilters.workflow_type_id;
      }
      if (appliedFilters.workflow_name_id) {
        params.workflow_name_id = appliedFilters.workflow_name_id;
      }

      get_dynamic_form(success_get_dynamic_form, params);
    }, [templateSubTab, searchTerm, page_number, appliedFilters, selectedWorkflowType, type]);

    useEffect(() => {
      fetchData();

      // Set module context based on type
      // Domain-specific labels are now handled by i18next namespaces (VITE_DOMAIN)
      if (type === "audit") {
        localStorage.setItem("current_module", "audit");
        sessionStorage.setItem("active_module", "audit");
      } else {
        localStorage.setItem("current_module", "configuration");
        sessionStorage.setItem("active_module", "configuration");
      }
    }, [fetchData, type, dispatch]);

    const fetchFieldGroups = () => {
      try {
        const groups = JSON.parse(localStorage.getItem("field_group_templates") || "[]");
        setFieldGroups(groups);
      } catch {
        setFieldGroups([]);
      }
    };

    useEffect(() => {
      get_checklist_type(success_get_checklist_type);
      fetchFieldGroups();

      // Fetch workflow types
      get_workflow_type((res) => {
        if (res.status === 200) {
          setWorkflowTypes(res.data.data || res.data || []);
        }
      });

      // Cleanup debounce timers on unmount
      return () => {
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
        }
        if (checklistDebounceTimer.current) {
          clearTimeout(checklistDebounceTimer.current);
        }
      };
    }, []);

    const navigate = useNavigate();

    const handleFormSubmit = (values, { resetForm }) => {
      const success_create_dynamic_form = (res) => {
        // post() passes response.data to callback, so res IS the API response
        // API response: { status: "success/failed", message: "...", data: { form_id, ... } }
        if (res?.status === "failed") {
          Toast.error(res?.message || t("Failed to create form"));
          return;
        }

        Toast.success(res?.message || t("Form created successfully!"));
        setShowForm(false);
        fetchData();

        // Ensure module context is set before navigation(audit)
        const isAuditContext = type === "audit";
        const moduleContext = isAuditContext ? "audit" : "configuration";
        localStorage.setItem("current_module", moduleContext);
        sessionStorage.setItem("active_module", moduleContext);
        //

        const formId = res?.data?.form_id || res?.data?.id;
        const versionId = res?.data?.version_id;
        // Store version_id for the newly created form
        if (versionId) {
          sessionStorage.setItem(`form_version_${formId}`, versionId);
        }
        navigate(`/form-details/${formId}?type=create`, {
          state: { ...values, id: formId, version_id: versionId },
        });
        resetForm();
      };

      // Create payload with desc instead of description
      const payload = {
        title: values.title,
        type_id: values.type_id,
        type: values.type,
        desc: values.description,
      };

      // Add PDCA fields to payload if PDCA is approved
      if (values.pdca_approved) {
        payload.location = values.location_id;
        payload.main_process = values.main_process_id;
        payload.criteria = values.criteria_id;
      }

      create_dynamic_form(success_create_dynamic_form, payload);
    };
    // Delete checklist handler
    const handleDeleteChecklist = async (id) => {
      try {
        const res = await delete_checklist_by_id(id);
        // del() returns response.data directly, so res IS the API response
        // API response: { status: "success/failed", message: "...", data: null }

        if (res?.status === "failed") {
          Toast.error(res?.message || t("Failed to delete form"));
        } else {
          Toast.success(res?.message || t("Form deleted successfully!"));
          fetchData();
        }
      } catch (error) {
        Toast.error(error?.response?.data?.message || error?.message || t("Failed to delete form"));
      }
    };

    // View handler
    const handleViewForm = (item) => {
      // Ensure module context is set before navigation(audit)
      const isAuditContext = type === "audit";
      const moduleContext = isAuditContext ? "audit" : "configuration";
      localStorage.setItem("current_module", moduleContext);
      sessionStorage.setItem("active_module", moduleContext);
      // Store form name for breadcrumb display
      if (item.title) {
        sessionStorage.setItem(`form_name_${item.id}`, item.title);
      }

      navigate(`/view-form/${item.id}`);
    };

    // Edit handler
    const handleEditForm = (item) => {
      // Ensure module context is set before navigation(audit)
      const isAuditContext = type === "audit";
      const moduleContext = isAuditContext ? "audit" : "configuration";
      localStorage.setItem("current_module", moduleContext);
      sessionStorage.setItem("active_module", moduleContext);
      // Store version_id for the form being edited
      sessionStorage.setItem(`form_version_${item.id}`, item.version_id);
      // Store form name for breadcrumb display
      if (item.title) {
        sessionStorage.setItem(`form_name_${item.id}`, item.title);
      }
      //
      const queryType = templateSubTab === "pending" ? "create" : "edit";
      navigate(`/form-details/${item.id}?type=${queryType}`, {
        state: {
          version_id: item.version_id,
          type_id: item.type_id || item.form_type_id,
          type: item.type || item.form_type,
        },
      });
    };

    const handleTabChange = (tab) => {
      setActiveTab(tab);
      setSearchParams({ tab });
      set_page_number(1);
      setSelectedWorkflowType(null);
    };

    // Bulk upload handler
    const handleBulkUpload = async (file, queryParams = {}) => {
      if (!file) return;
      try {
        setLoading(true);
        const res = await upload_forms_data(file, null, null, queryParams);

        if (res?.status === "failed") {
          Toast.error(res?.message || t("Failed to upload forms data"));
          return res;
        }

        Toast.success(res?.message || t("Forms uploaded successfully"));
        fetchData();
        return res;
      } catch (err) {
        const apiMsg =
          err?.response?.data?.message ||
          err?.message ||
          t("Failed to upload forms data");
        Toast.error(apiMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    };

    // Handle version change
    const handleVersionChange = (formId, selectedVersion) => {
      try {
        // Find the form item and its version data
        const currentForm = data.find((item) => item.id === formId);
        if (!currentForm || !currentForm.all_versions) {
          return;
        }

        // Find the selected version's ID
        const selectedVersionData = currentForm.all_versions.find(
          (v) => v.version === selectedVersion
        );
        if (!selectedVersionData) {
          return;
        }

        // Prevent switching to the same version
        if (currentForm.version === selectedVersion) {
          return;
        }

        // Update the data state to reflect the version change
        const updatedData = data.map((item) => {
          if (item.id === formId) {
            return {
              ...item,
              version: selectedVersion,
              id: selectedVersionData.id, // Update to the selected version's ID
            };
          }
          return item;
        });

        set_data(updatedData);
      } catch (error) {
        console.error("Error switching version:", error);
      }
    };

    const handleSearch = (value) => {
      // Clear existing timer
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      // Set new timer for debouncing
      debounceTimer.current = setTimeout(() => {
        setSearchTerm(value);
        set_page_number(1);
      }, 500); // 500ms debounce delay
    };

    const handleFilterSubmit = (values) => {
      setAppliedFilters({
        form_type_id: values.form_type_id || null,
        workflow_type_id: values.workflow_type_id || null,
        workflow_name_id: values.workflow_name_id || null,
      });
      set_page_number(1);
      setShowFilters(false);
      Toast.success(t("Filters applied successfully!"));
    };

    const handleWorkflowTypeChange = (typeId, setFieldValue) => {
      setFieldValue("workflow_type_id", typeId);
      setFieldValue("workflow_name_id", null); // Reset workflow list selection

      if (typeId) {
        // Fetch workflow list based on selected type
        get_workflow_list(
          (res) => {
            if (res.status === 200) {
              setWorkflowList(res.data.data || res.data || []);
            }
          },
          { type_id: typeId }
        );
      } else {
        setWorkflowList([]);
      }
    };

    // Fetch PDCA dropdown data
    const fetchPDCAData = async () => {
      // Fetch locations - response: { data: [...locations] }
      try {
        const locationRes = await get_Locationnew(1, 100, "", "dropdown");
        // Handle axios response structure: res.data.data or res.data (if data is array)
        if (Array.isArray(locationRes?.data?.data)) {
          setLocationList(locationRes.data.data);
        } else if (Array.isArray(locationRes?.data)) {
          setLocationList(locationRes.data);
        }
      } catch (err) {
        console.error("Error fetching locations:", err);
      }

      // Fetch main processes - response: { status, message, data: [...] }
      get_main_processes((res) => {
        // res could be axios response or response body
        // New API structure: data is directly an array
        const mainProcesses = res?.data?.data || res?.data;
        if (Array.isArray(mainProcesses)) {
          setMainProcessList(mainProcesses);
        }
      });

      // Fetch criteria - response: { status, message, data: [...] }
      get_criteria((res) => {
        // res could be axios response or response body
        // New API structure: data is directly an array
        const criteria = res?.data?.data || res?.data;
        if (Array.isArray(criteria)) {
          setCriteriaList(criteria);
        }
      });
    };

    const renderCards = (data, isPending = true) => {
      if (loading) {
        return (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-white mx-auto mb-3"></div>
            <p className="text-text-skin-placeholder text-lg font-medium">
              {t("Loading...")}
            </p>
          </div>
        );
      }

      if (!data || data.length === 0) {
        return (
          <div className="text-center py-8">
            <div
              className={`mx-auto h-16 w-16 rounded-full flex items-center justify-center mb-3 ${isPending ? "bg-amber-100 dark:bg-amber-200" : "bg-emerald-100 dark:bg-emerald-500"
                }`}
            >
              <FileSearch
                className={`h-8 w-8 ${isPending
                  ? "text-amber-600 dark:text-amber-700"
                  : "text-emerald-600 dark:text-emerald-900"
                  }`}
              />
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
              {searchTerm ? t("No search results found") : t("No items found")}
            </p>
            <p className="text-text-skin-secondary text-sm mt-1.5">
              {searchTerm
                ? `${t("No items match")} "${searchTerm}"`
                : isPending
                  ? t("Create your first entry using the form above")
                  : t("No completed items yet")}
            </p>
          </div>
        );
      }

      return (
        <div className="grid gap-3 md:grid-cols-3">
          {/* form card data  */}
          {data.map((item) => (
            <div
              key={item.key || item.id}
              className="group relative bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 transition-all duration-300 overflow-hidden"

              style={{ borderRadius: 20 }}
            >
              {/* Row 1: Icon + Title/Description + Type/Version Tags */}
              <div className="px-4 py-5 flex items-center gap-3">
                <div
                  className={`w-11 h-11 flex items-center justify-center shrink-0 ${isPending
                    ? "bg-amber-100 dark:bg-amber-500"
                    : "bg-emerald-100 dark:bg-emerald-500"
                    }`}
                  style={{ borderRadius: 14 }}
                >
                  {isPending ? (
                    <Clock className="h-5 w-5 text-amber-600 dark:text-amber-900" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-900" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold text-text-skin-base truncate leading-tight">
                    {item.title}
                  </h3>
                  <p className="text-xs text-text-skin-secondary truncate mt-0.5">
                    {item.description && item.description.length > 60
                      ? `${item.description.substring(0, 60)}...`
                      : item.description}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Type Tag */}
                  <span
                    className="inline-flex items-center px-3.5 py-1 rounded-full text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300"
                    data-testid={`dynamic-form-btn-type-${item.id}`}
                  >
                    {item.type}
                  </span>

                  {/* Version Tag */}
                  {item.all_versions && item.all_versions.length > 1 ? (
                    <Dropdown
                      menu={{
                        items: item.all_versions
                          .sort((a, b) => b.version - a.version)
                          .map((versionItem) => ({
                            key: versionItem.id,
                            label: `${t("Version")} ${versionItem.version}`,
                            onClick: () =>
                              handleVersionChange(
                                item.id,
                                versionItem.version
                              ),
                          })),
                      }}
                      trigger={["click"]}
                    >
                      <span
                        className="inline-flex items-center gap-1 px-3.5 py-1 rounded-full text-sm font-medium border border-emerald-400 dark:border-emerald-600 text-emerald-600 dark:text-emerald-400 cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                        data-testid={`dynamic-form-btn-version-dropdown-${item.id}`}
                      >
                        {t("Version")} {item.version}
                        <ChevronDown size={12} />
                      </span>
                    </Dropdown>
                  ) : (
                    <span
                      className="inline-flex items-center px-3.5 py-1 rounded-full text-sm font-medium border border-emerald-400 dark:border-emerald-600 text-emerald-600 dark:text-emerald-400"
                      data-testid={`dynamic-form-btn-version-${item.id}`}
                    >
                      {t("Version")} {item.version}
                    </span>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-200 dark:border-gray-700 mx-4" />

              {/* Row 2: Date + Action Buttons */}
              <div className="px-4 py-3 flex items-center justify-between gap-2">
                {/* Created On */}
                <div className="flex items-center gap-1.5 text-xs text-text-skin-secondary whitespace-nowrap shrink-0">
                  <Clock size={14} className="shrink-0" />
                  <span className="font-medium">{item.created_on || "-"}</span>
                </div>

                {isPending ? (
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Edit */}
                    <Button
                      size="small"
                      icon={<Edit size={14} />}
                      onClick={() => handleEditForm(item)}
                      className="rounded-lg"
                      data-testid={`dynamic-form-btn-edit-pending-${item.id}`}
                    >
                      {t("Edit")}
                    </Button>

                    {/* Delete */}
                    <Popconfirm
                      title={t("Are you sure to delete this form ?")}
                      onConfirm={() => handleDeleteChecklist(item.id)}
                      okText="Delete"
                      cancelText="Cancel"
                      placement="leftTop"
                    >
                      <Button
                        size="small"
                        icon={<Trash2 size={14} />}
                        className="rounded-lg"
                        data-testid={`dynamic-form-btn-delete-pending-${item.id}`}
                      >
                        {t("Delete")}
                      </Button>
                    </Popconfirm>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 shrink-0">
                    {/* View */}
                    <Button
                      size="small"
                      icon={<Eye size={14} />}
                      onClick={() => handleViewForm(item)}
                      className="rounded-lg"
                      data-testid={`dynamic-form-btn-view-${item.id}`}
                    >
                      {t("View")}
                    </Button>

                    {/* Edit */}
                    <Button
                      size="small"
                      icon={<Edit size={14} />}
                      onClick={() => handleEditForm(item)}
                      className="rounded-lg"
                      data-testid={`dynamic-form-btn-edit-${item.id}`}
                    >
                      {t("Edit")}
                    </Button>

                    {/* Delete */}
                    <Popconfirm
                      title={t("Are you sure to delete this form ?")}
                      onConfirm={() => handleDeleteChecklist(item.id)}
                      okText={t("Delete")}
                      cancelText={t("Cancel")}
                      placement="leftTop"
                    >
                      <Button
                        size="small"
                        icon={<Trash2 size={14} />}
                        className="rounded-lg"
                        data-testid={`dynamic-form-btn-delete-${item.id}`}
                      >
                        {t("Delete")}
                      </Button>
                    </Popconfirm>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    };

    // Checklist Templates handlers
    const handleChecklistExport = async () => {
      try {
        setChecklistExporting(true);
        await export_iso_standards("iso_standards.xlsx");
        Toast.success(t("Checklists exported successfully"));
      } catch (error) {
        Toast.error(error?.message || t("Failed to export checklists"));
      } finally {
        setChecklistExporting(false);
      }
    };

    const handleChecklistBulkUpload = (event) => {
      const file = event.target.files[0];
      if (!file) return;

      setChecklistUploading(true);
      bulk_upload_iso_standards(
        (res) => {
          setChecklistUploading(false);
          if (res?.status === "failed") {
            Toast.error(res?.message || t("Failed to upload checklists"));
          } else {
            Toast.success(res?.message || t("Checklists uploaded successfully"));
            // Refresh the checklist table
            if (checklistRef.current?.fetchChecklists) {
              checklistRef.current.fetchChecklists();
            }
          }
        },
        file,
        (error) => {
          setChecklistUploading(false);
          Toast.error(error?.message || t("Failed to upload checklists"));
        }
      );
      event.target.value = "";
    };

    const handleChecklistCreate = () => {
      if (checklistRef.current?.handleCreate) {
        checklistRef.current.handleCreate();
      }
    };

    // Debounced checklist search handler
    const handleChecklistSearch = (value) => {
      setChecklistSearchText(value);

      // Clear existing timer
      if (checklistDebounceTimer.current) {
        clearTimeout(checklistDebounceTimer.current);
      }

      // Set new timer for debouncing
      checklistDebounceTimer.current = setTimeout(() => {
        setDebouncedChecklistSearch(value);
      }, 500); // 500ms debounce delay
    };

    // Download sample ISO standard template
    const handleDownloadChecklistSample = () => {
      // Create sample data matching ISO standard structure
      const sampleData = [
        ["Standard Name", "Remarks", "Clause Number", "Clause Title", "Sub-Clause Number", "Sub-Clause Title", "Requirement Text"],
        ["ISO 9001:2015", "Quality Management System", "4", "Context of the organization", "4.1", "Understanding the organization and its context", "The organization shall determine external and internal issues that are relevant to its purpose and its strategic direction."],
        ["ISO 9001:2015", "Quality Management System", "4", "Context of the organization", "4.2", "Understanding the needs and expectations of interested parties", "The organization shall determine the interested parties that are relevant to the quality management system."],
        ["ISO 9001:2015", "Quality Management System", "5", "Leadership", "5.1", "Leadership and commitment", "Top management shall demonstrate leadership and commitment with respect to the quality management system."],
        ["ISO 9001:2015", "Quality Management System", "5", "Leadership", "5.2", "Quality policy", "Top management shall establish, implement and maintain a quality policy."],
        ["ISO 45001:2018", "OH&S Management System", "4", "Context of the organization", "4.1", "Understanding the organization and its context", "The organization shall determine external and internal issues that are relevant to its purpose."],
        ["ISO 45001:2018", "OH&S Management System", "4", "Context of the organization", "4.2", "Understanding the needs and expectations of workers", "The organization shall determine the other interested parties that are relevant to the OH&S management system."],
      ];

      // Convert to CSV format
      const csvContent = sampleData
        .map((row) => row.map((cell) => `"${cell}"`).join(","))
        .join("\n");

      // Create blob and download
      const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "iso_standard_sample_template.csv");
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      Toast.success(t("Sample template downloaded successfully"));
    };

    // ==================== FIELD GROUPS CRUD HANDLERS ====================

    // Create Field Group — stored in localStorage
    const handleCreateFieldGroup = (values) => {
      const newId = `fg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const newGroup = {
        id: newId,
        title: values.title,
        description: values.description,
        sections: [],
        fields: [],
        created_at: new Date().toISOString(),
      };
      const existing = JSON.parse(localStorage.getItem("field_group_templates") || "[]");
      const updated = [...existing, newGroup];
      localStorage.setItem("field_group_templates", JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("fieldGroupsUpdated"));
      setFieldGroups(updated);
      Toast.success(t("Field group created successfully"));
      setShowCreateFieldGroup(false);
      localStorage.setItem("current_module", "configuration");
      sessionStorage.setItem("active_module", "configuration");
      navigate(`/field-group/${newId}?type=create`, {
        state: { id: newId, title: values.title, type: "create" },
      });
    };

    // View Field Group
    const handleViewFieldGroup = (fieldGroup) => {
      localStorage.setItem("current_module", "configuration");
      sessionStorage.setItem("active_module", "configuration");
      navigate(`/field-group-preview/${fieldGroup.id}`);
    };

    // Edit Field Group
    const handleEditFieldGroup = (fieldGroup) => {
      localStorage.setItem("current_module", "configuration");
      sessionStorage.setItem("active_module", "configuration");
      navigate(`/field-group/${fieldGroup.id}?type=edit`, {
        state: { id: fieldGroup.id, title: fieldGroup.title, type: "edit" },
      });
    };

    // Delete Field Group — stored in localStorage
    const handleDeleteFieldGroup = (fieldGroupId) => {
      const existing = JSON.parse(localStorage.getItem("field_group_templates") || "[]");
      const updated = existing.filter((g) => g.id !== fieldGroupId);
      localStorage.setItem("field_group_templates", JSON.stringify(updated));
      setFieldGroups(updated);
      Toast.success(t("Field group deleted successfully"));
    };

    // Close modals
    const handleCloseFieldGroupForm = () => {
      setShowCreateFieldGroup(false);
    };

    // ==================== END FIELD GROUPS CRUD HANDLERS ====================

    // Render Section Templates
    const renderSectionTemplates = () => {
      if (!fieldGroups || fieldGroups.length === 0) {
        return (
          <div className="flex flex-col items-center justify-center py-20">
            <NxLayoutGrid size={48} className="text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-semibold text-text-skin-base mb-1">{t("No Field Groups Yet")}</h3>
            <p className="text-sm text-text-skin-secondary mb-4">{t("Create your first field group to reuse sections across templates.")}</p>
          </div>
        );
      }
      return (
        <div className="grid gap-3 md:grid-cols-3">
          {fieldGroups.map((template) => (
            <div
              key={template.id}
              className="group relative bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 transition-all duration-300 overflow-hidden"
              style={{ borderRadius: 20 }}
            >
              {/* Row 1: Icon + Title/Description */}
              <div className="px-4 py-5 flex items-center gap-3">
                <div
                  className="w-11 h-11 flex items-center justify-center shrink-0 bg-blue-100 dark:bg-blue-500"
                  style={{ borderRadius: 14 }}
                >
                  <NxLayoutGrid className="h-5 w-5 text-blue-600 dark:text-blue-900" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold text-text-skin-base truncate leading-tight">
                    {template.title}
                  </h3>
                  <p className="text-xs text-text-skin-secondary truncate mt-0.5">
                    {template.description && template.description.length > 60
                      ? `${template.description.substring(0, 60)}...`
                      : template.description}
                  </p>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-200 dark:border-gray-700 mx-4" />

              {/* Row 2: Date + Action Buttons */}
              <div className="px-4 py-3 flex items-center justify-between gap-2">
                {/* Created On */}
                <div className="flex items-center gap-1.5 text-xs text-text-skin-secondary whitespace-nowrap shrink-0">
                  <Clock size={14} className="shrink-0" />
                  <span className="font-medium">{template.created_on || "-"}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* View */}
                  <Button
                    size="small"
                    icon={<Eye size={14} />}
                    onClick={() => handleViewFieldGroup(template)}
                    className="rounded-lg"
                  >
                    {t("View")}
                  </Button>

                  {/* Edit */}
                  <Button
                    size="small"
                    icon={<Edit size={14} />}
                    onClick={() => handleEditFieldGroup(template)}
                    className="rounded-lg"
                  >
                    {t("Edit")}
                  </Button>

                  {/* Delete */}
                  <Popconfirm
                    title={t("Delete Field Group")}
                    description={t("Are you sure you want to delete this field group?")}
                    onConfirm={() => handleDeleteFieldGroup(template.id)}
                    okText={t("Yes")}
                    cancelText={t("No")}
                    placement="leftTop"
                  >
                    <Button
                      size="small"
                      icon={<Trash2 size={14} />}
                      className="rounded-lg"
                    >
                      {t("Delete")}
                    </Button>
                  </Popconfirm>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    };

    return (
      <>
        <PageWrapper
          title={t("Template Manager")}
          subTitle={t("Create entries and manage their status")}
          showBack={true}
          data-testid="dynamic-form-template-manager-page"
          headerSiblingContent={
            <div className="flex flex-row gap-2 items-center">
              {/* Portal target for WorkflowsList controls */}
              {activeTab === "workflow" && (
                <div ref={setWorkflowHeaderEl} className="flex items-center gap-2" />
              )}
              {activeTab !== "audit-checklists" && activeTab !== "workflow" && (
                <div className="relative w-64">
                  <FileSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 h-4 w-4" />
                  <Input
                    size="large"
                    placeholder={t("Search by title...")}
                    defaultValue={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    allowClear
                    className="pl-10 bg-skin-fill-secondary text-text-skin-placeholder"
                  />
                </div>
              )}
              {activeTab === "templates" && (
                <>
                  <Popover
                    content={
                      <div style={{ width: 300 }}>
                        <Formik
                          initialValues={{
                            form_type_id: appliedFilters.form_type_id,
                            workflow_type_id: appliedFilters.workflow_type_id,
                            workflow_name_id: appliedFilters.workflow_name_id,
                          }}
                          onSubmit={handleFilterSubmit}
                          enableReinitialize
                        >
                          {({ values, setFieldValue, handleSubmit, resetForm }) => (
                            <Form
                              layout="vertical"
                              onFinish={handleSubmit}
                              className="dynamic-form-no-margin"
                            >
                              <Form.Item
                                label={
                                  <span className="text-text-skin-base">
                                    {t("Form Types")}
                                  </span>
                                }
                              >
                                <Select
                                  size="middle"
                                  value={values.form_type_id}
                                  onChange={(val) =>
                                    setFieldValue("form_type_id", val)
                                  }
                                  options={type_list.map((i) => ({
                                    label: i.name,
                                    value: i.id,
                                  }))}
                                  placeholder={t("Select Form Type")}
                                  allowClear
                                  showSearch
                                  optionFilterProp="children"
                                  filterOption={(input, option) =>
                                    (option?.label ?? "")
                                      .toLowerCase()
                                      .includes(input.toLowerCase())
                                  }
                                />
                              </Form.Item>

                              <Form.Item
                                label={
                                  <span className="text-text-skin-base">
                                    {t("Workflow Type")}
                                  </span>
                                }
                              >
                                <Select
                                  size="middle"
                                  value={values.workflow_type_id}
                                  onChange={(val) =>
                                    handleWorkflowTypeChange(val, setFieldValue)
                                  }
                                  options={workflowTypes.map((i) => ({
                                    label: i.name || i.workflow_type,
                                    value: i.id,
                                  }))}
                                  placeholder={t("Select Workflow Type")}
                                  allowClear
                                  showSearch
                                  optionFilterProp="children"
                                  filterOption={(input, option) =>
                                    (option?.label ?? "")
                                      .toLowerCase()
                                      .includes(input.toLowerCase())
                                  }
                                />
                              </Form.Item>

                              <Form.Item
                                label={
                                  <span className="text-text-skin-base">
                                    {t("Workflow List")}
                                  </span>
                                }
                              >
                                <Select
                                  size="middle"
                                  value={values.workflow_name_id}
                                  onChange={(val) =>
                                    setFieldValue("workflow_name_id", val)
                                  }
                                  options={workflowList.map((i) => ({
                                    label: i.name || i.workflow_name,
                                    value: i.id,
                                  }))}
                                  placeholder={t("Select Workflow")}
                                  allowClear
                                  disabled={!values.workflow_type_id}
                                  showSearch
                                  optionFilterProp="children"
                                  filterOption={(input, option) =>
                                    (option?.label ?? "")
                                      .toLowerCase()
                                      .includes(input.toLowerCase())
                                  }
                                />
                              </Form.Item>

                              <div className="flex justify-end gap-3 mt-4">
                                <Button
                                  size="middle"
                                  onClick={() => {
                                    resetForm();
                                    setAppliedFilters({
                                      form_type_id: null,
                                      workflow_type_id: null,
                                      workflow_name_id: null,
                                    });
                                    setWorkflowList([]);
                                    set_page_number(1);
                                  }}
                                >
                                  {t("Clear")}
                                </Button>
                                <Button
                                  type="primary"
                                  size="middle"
                                  htmlType="submit"
                                  className="bg-blue-600 hover:bg-blue-700"
                                >
                                  {t("Apply")}
                                </Button>
                              </div>
                            </Form>
                          )}
                        </Formik>
                      </div>
                    }
                    title={
                      <span className="text-text-skin-base font-semibold">
                        {t("Filters")}
                      </span>
                    }
                    trigger="click"
                    open={showFilters}
                    onOpenChange={setShowFilters}
                    placement="bottomRight"
                  >
                    <Button
                      icon={<Filter size={16} />}
                      size="large"
                      className="text-text-skin-base"
                    >
                      {t("Filters")}
                    </Button>
                  </Popover>
                  <Button
                    type="default"
                    icon={<NxDownload className="mr-2" size={16} />}
                    size="large"
                    onClick={() => {
                      export_forms_bulk(
                        () => Toast.success(t("Forms exported successfully")),
                        () => Toast.error(t("Failed to export forms"))
                      );
                    }}
                    className="text-text-skin-base"
                    data-testid="dynamic-form-btn-bulk-export"
                  >
                    {t("Bulk Export")}
                  </Button>
                  <Button
                    type="default"
                    icon={<NxCloudUpload className="mr-2" size={16} />}
                    size="large"
                    onClick={() => setIsBulkUploadModalOpen(true)}
                    className="text-text-skin-base"
                    data-testid="dynamic-form-btn-bulk-upload"
                  >
                    {t("Bulk Upload")}
                  </Button>
                  <Button
                    type="primary"
                    icon={<PlusCircle className="mr-2" size={16} />}
                    size="large"
                    onClick={() => setShowForm((prev) => !prev)}
                    className="text-text-skin-base"
                    data-testid="dynamic-form-btn-create-template"
                  >
                    {showForm ? t("Close Template") : t("Create Template")}
                  </Button>
                </>
              )}
              {activeTab === "section-templates" && (
                <Button
                  type="primary"
                  icon={<PlusCircle className="mr-2" size={16} />}
                  size="large"
                  onClick={() => setShowCreateFieldGroup((prev) => !prev)}
                  className="text-text-skin-base"
                >
                  {showCreateFieldGroup ? t("Close Field Group") : t("Create Field Group")}
                </Button>
              )}
              {activeTab === "audit-checklists" && (
                <>
                  <div className="relative w-64">
                    <FileSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 h-4 w-4" />
                    <Input
                      size="large"
                      placeholder={t("Search by title...")}
                      value={checklistSearchText}
                      onChange={(e) => handleChecklistSearch(e.target.value)}
                      allowClear
                      className="pl-10 bg-skin-fill-secondary text-text-skin-placeholder"
                    />
                  </div>
                  <Button
                    icon={<Filter size={16} />}
                    size="large"
                    className="text-text-skin-base"
                  >
                    {t("Filters")}
                  </Button>
                  <Button
                    type="default"
                    icon={<NxDownload className="mr-2" size={16} />}
                    size="large"
                    onClick={handleDownloadChecklistSample}
                    className="text-text-skin-base"
                  >
                    {t("Download Sample")}
                  </Button>
                  <Button
                    type="default"
                    icon={<NxDownload className="mr-2" size={16} />}
                    size="large"
                    onClick={handleChecklistExport}
                    loading={checklistExporting}
                    className="text-text-skin-base"
                  >
                    {t("Bulk Export")}
                  </Button>
                  <input
                    type="file"
                    ref={checklistFileInputRef}
                    accept=".xlsx,.xls,.csv"
                    onChange={handleChecklistBulkUpload}
                    style={{ display: "none" }}
                  />
                  <Button
                    type="default"
                    icon={<NxCloudUpload className="mr-2" size={16} />}
                    size="large"
                    onClick={() => checklistFileInputRef.current?.click()}
                    loading={checklistUploading}
                    className="text-text-skin-base"
                  >
                    {t("Bulk Upload")}
                  </Button>
                  <Button
                    type="primary"
                    icon={<PlusCircle className="mr-2" size={16} />}
                    size="large"
                    onClick={handleChecklistCreate}
                    className="text-text-skin-base"
                  >
                    {t("Create Checklist")}
                  </Button>
                </>
              )}
            </div>
          }
        >
          {/* Form Creation Section - Hide for Audit Checklists tab */}
          {showForm && activeTab !== "audit-checklists" && (
            <div className="bg-skin-card border border-border-skin-base hover:border-border-skin-hover rounded-lg px-4 py-3 mb-3">
              <Formik
                initialValues={{
                  title: null,
                  type_id: null,
                  description: null,
                  pdca_approved: false,
                  location_id: null,
                  main_process_id: null,
                  criteria_id: null,
                }}
                validationSchema={validationSchema}
                onSubmit={handleFormSubmit}
              >
                {({
                  values,
                  handleChange,
                  handleBlur,
                  handleSubmit,
                  setFieldValue,
                  errors,
                  touched,
                  resetForm,
                }) => (
                  <Form
                    layout="vertical"
                    onFinish={handleSubmit}
                    className="dynamic-form-no-margin"
                  >
                    <Row gutter={[16, 2]}>
                      {/* Title */}
                      <Col span={12}>
                        <Form.Item
                          label={
                            <span className="text-text-skin-base">
                              {t("Title")}
                            </span>
                          }
                          validateStatus={
                            touched.title && errors.title ? "error" : ""
                          }
                          help={touched.title && errors.title}
                        >
                          <SpellCheckInput
                            name="title"
                            value={values.title}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            size="large"
                            placeholder={t("Enter Title")}
                          />
                        </Form.Item>
                      </Col>

                      {/* Type (with dynamic list) */}
                      <Col span={12}>
                        <Form.Item
                          label={t("Type")}
                          validateStatus={
                            touched.type_id && errors.type_id ? "error" : ""
                          }
                          help={touched.type_id && errors.type_id}
                        >
                          <div className="flex items-center gap-2">
                            <Select
                              size="large"
                              value={values.type_id}
                              open={typeSelectOpen}
                              onDropdownVisibleChange={(open) => setTypeSelectOpen(open)}
                              onChange={(val, option) => {
                                setFieldValue("type_id", val);
                                setFieldValue("type", option.label);
                              }}
                              options={type_list.map((i) => ({
                                label: i.name,
                                value: i.id,
                                typeItem: i,
                              }))}
                              placeholder={t("Select Type")}
                              onBlur={handleBlur}
                              showSearch
                              optionFilterProp="label"
                              filterOption={(input, option) =>
                                (option?.label ?? "")
                                  .toLowerCase()
                                  .includes(input.toLowerCase())
                              }
                              optionRender={(option) => (
                                <div className="flex items-center justify-between w-full pr-2">
                                  <span>{option.data.label}</span>
                                  <div className="flex items-center gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
                                    <Tooltip title={t("Edit")}>
                                      <Button
                                        type="text"
                                        size="small"
                                        icon={<Edit size={16} />}
                                        onClick={(e) => handleEditType(option.data.typeItem, e)}
                                        className="p-1 min-w-0 h-7 w-7 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                      />
                                    </Tooltip>
                                    <Popconfirm
                                      title={t("Delete Type")}
                                      description={t("Are you sure you want to delete this type?")}
                                      onConfirm={(e) => handleDeleteType(option.data.typeItem, e)}
                                      okText={t("Yes")}
                                      cancelText={t("No")}
                                      placement="left"
                                    >
                                      <Tooltip title={t("Delete")}>
                                        <Button
                                          type="text"
                                          size="small"
                                          icon={<Trash2 size={16} />}
                                          onClick={(e) => e.stopPropagation()}
                                          className="p-1 min-w-0 h-7 w-7 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        />
                                      </Tooltip>
                                    </Popconfirm>
                                  </div>
                                </div>
                              )}
                            />
                            <Button
                              size="large"
                              type="default"
                              icon={<Plus size={20} />}
                              onClick={() => setOpenAddFormType(true)}
                            />
                          </div>
                        </Form.Item>
                      </Col>

                      {/* Description */}
                      <Col span={24}>
                        <Form.Item
                          label={t("Description")}
                          validateStatus={
                            touched.description && errors.description
                              ? "error"
                              : ""
                          }
                          help={touched.description && errors.description}
                        >
                          <SpellCheckTextArea
                            name="description"
                            value={values.description}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            size="large"
                            rows={3}
                            placeholder={t("Enter description")}
                          />
                        </Form.Item>
                      </Col>

                      {/* PDCA Approved Checkbox */}
                      <Col span={24}>
                        <Form.Item>
                          <Checkbox
                            checked={values.pdca_approved}
                            onChange={(e) => {
                              setFieldValue("pdca_approved", e.target.checked);
                              if (e.target.checked) {
                                fetchPDCAData();
                              } else {
                                // Reset PDCA fields when unchecked
                                setFieldValue("location_id", null);
                                setFieldValue("main_process_id", null);
                                setFieldValue("criteria_id", null);
                              }
                            }}
                          >
                            <span className="text-text-skin-base font-medium">
                              {t("PDCA Approved")}
                            </span>
                          </Checkbox>
                        </Form.Item>
                      </Col>

                      {/* PDCA Conditional Fields */}
                      {values.pdca_approved && (
                        <>
                          {/* Location */}
                          <Col span={8}>
                            <Form.Item
                              label={
                                <span className="text-text-skin-base">
                                  {t("Location")}
                                </span>
                              }
                            >
                              <Select
                                size="large"
                                value={values.location_id}
                                onChange={(val) => setFieldValue("location_id", val)}
                                options={locationList.map((loc) => ({
                                  label: loc.name,
                                  value: loc.id,
                                }))}
                                placeholder={t("Select Location")}
                                allowClear
                                showSearch
                                optionFilterProp="label"
                                filterOption={(input, option) =>
                                  (option?.label ?? "")
                                    .toLowerCase()
                                    .includes(input.toLowerCase())
                                }
                              />
                            </Form.Item>
                          </Col>

                          {/* Main Process */}
                          <Col span={8}>
                            <Form.Item
                              label={
                                <span className="text-text-skin-base">
                                  {t("Main Process")}
                                </span>
                              }
                            >
                              <Select
                                size="large"
                                value={values.main_process_id}
                                onChange={(val) => setFieldValue("main_process_id", val)}
                                options={mainProcessList.map((proc) => ({
                                  label: proc.name,
                                  value: proc.id,
                                }))}
                                placeholder={t("Select Main Process")}
                                allowClear
                                showSearch
                                optionFilterProp="label"
                                filterOption={(input, option) =>
                                  (option?.label ?? "")
                                    .toLowerCase()
                                    .includes(input.toLowerCase())
                                }
                              />
                            </Form.Item>
                          </Col>

                          {/* Criteria */}
                          <Col span={8}>
                            <Form.Item
                              label={
                                <span className="text-text-skin-base">
                                  {t("Criteria")}
                                </span>
                              }
                            >
                              <Select
                                size="large"
                                value={values.criteria_id}
                                onChange={(val) => setFieldValue("criteria_id", val)}
                                options={criteriaList.map((crit) => ({
                                  label: crit.name,
                                  value: crit.id,
                                }))}
                                placeholder={t("Select Criteria")}
                                allowClear
                                showSearch
                                optionFilterProp="label"
                                filterOption={(input, option) =>
                                  (option?.label ?? "")
                                    .toLowerCase()
                                    .includes(input.toLowerCase())
                                }
                              />
                            </Form.Item>
                          </Col>
                        </>
                      )}

                      {/* Buttons */}
                      <Col span={24}>
                        <div className="flex justify-end space-x-4">
                          <Button
                            size="large"
                            onClick={() => {
                              resetForm();
                            }}
                          >
                            {t("Reset")}
                          </Button>
                          <Button
                            type="primary"
                            className="dark:hover:bg-blue-700"
                            htmlType="submit"
                            size="large"
                          >
                            {t("Submit")}
                          </Button>
                        </div>
                      </Col>
                    </Row>
                  </Form>
                )}
              </Formik>
            </div>
          )}

          {/* Field Group Creation Section */}
          {showCreateFieldGroup && activeTab === "section-templates" && (
            <div className="bg-skin-card border border-border-skin-base hover:border-border-skin-hover rounded-lg p-6 mb-6">
              <CreateFieldGroupForm
                onClose={handleCloseFieldGroupForm}
                onSubmit={handleCreateFieldGroup}
              />
            </div>
          )}

          {/* Tabs and Content Section - hidden when create form is open */}
          <div className={`bg-skin-card px-4 py-2 backdrop-blur-sm border dark:border-gray-700 rounded-xl border-skin-card-selected ${showForm ? "hidden" : ""}`}>
            <Tabs
              activeKey={activeTab}
              onChange={handleTabChange}
              size="large"
              data-testid="dynamic-form-tabs"
              tabBarExtraContent={
                activeTab === "templates" && templateInnerTab === "forms" && !selectedWorkflowType ? (
                  <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-1">
                    <button
                      onClick={() => setTemplateSubTab("completed")}
                      className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                        templateSubTab === "completed"
                          ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                          : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                      }`}
                    >
                      <CheckCircle size={16} />
                      {t("Completed")}
                    </button>
                    <button
                      onClick={() => setTemplateSubTab("pending")}
                      className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                        templateSubTab === "pending"
                          ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                          : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                      }`}
                    >
                      <Clock size={16} />
                      {t("Pending")}
                    </button>
                  </div>
                ) : null
              }
              items={[
                {
                  key: "workflow",
                  label: (
                    <div className="flex items-center gap-2">
                      <NxNetwork size={18} />
                      {t("Workflow")}
                    </div>
                  ),
                  children: (
                    <div className="p-1">
                      <WorkflowsList headerPortalEl={workflowHeaderEl} />
                    </div>
                  ),
                },
                {
                  key: "templates",
                  label: (
                    <div className="flex items-center gap-2">
                      <Edit size={18} />
                      {t("Templates")}
                    </div>
                  ),
                  children: (
                    <div className="p-1">
                      <Tabs
                        activeKey={templateInnerTab}
                        onChange={(key) => { setTemplateInnerTab(key); setSelectedWorkflowType(null); set_page_number(1); }}
                        size="small"
                        items={[
                          {
                            key: "forms",
                            label: (
                              <div className="flex items-center gap-2">
                                <Edit size={16} />
                                {t("Templates")}
                              </div>
                            ),
                            children: selectedWorkflowType ? (
                              <>
                                <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center gap-3">
                                    <span className="text-lg font-semibold text-text-skin-base">
                                      {selectedWorkflowType.name || selectedWorkflowType.workflow_type}
                                    </span>
                                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                      {total} {t("templates")}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => { setSelectedWorkflowType(null); set_page_number(1); }}
                                    className="flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                                  >
                                    {t("Back")}
                                    <ChevronDown size={16} className="-rotate-90" />
                                  </button>
                                </div>
                                {renderCards(data, templateSubTab === "pending")}
                              </>
                            ) : templateSubTab === "pending" ? (
                              renderCards(data, true)
                            ) : (
                              workflowTypes.length > 0 ? (
                                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                                  {workflowTypes.map((wfType) => (
                                    <div
                                      key={wfType.id}
                                      onClick={() => { setSelectedWorkflowType(wfType); set_page_number(1); }}
                                      className="cursor-pointer group rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md transition-all duration-200 p-5 flex items-center justify-between"
                                    >
                                      <h3 className="text-base font-semibold text-text-skin-base truncate">
                                        {wfType.name || wfType.workflow_type}
                                      </h3>
                                      <ChevronDown size={16} className="-rotate-90 text-gray-400 shrink-0" />
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center py-8">
                                  <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
                                    {t("No workflow types found")}
                                  </p>
                                </div>
                              )
                            ),
                          },
                          {
                            key: "field-groups",
                            label: (
                              <div className="flex items-center gap-2">
                                <NxLayoutGrid size={16} />
                                {t("Field Groups")}
                              </div>
                            ),
                            children: (
                              <div className="p-1">
                                {renderSectionTemplates()}
                              </div>
                            ),
                          },
                          {
                            key: "checklists",
                            label: (
                              <div className="flex items-center gap-2">
                                <NxClipboardList size={16} />
                                {t("Checklists")}
                              </div>
                            ),
                            children: <AuditChecklists ref={checklistRef} searchText={debouncedChecklistSearch} />,
                          },
                        ]}
                      />
                    </div>
                  ),
                },
              ]}
            />
          </div>

          {/* Pagination - Hide for Section Templates and Audit Checklists tabs */}
          {total > 0 && activeTab === "templates" && selectedWorkflowType && (
            <div className="flex justify-center mt-6">
              <Pagination
                size="large"
                total={total}
                showTotal={(total) => `${t("Total")} ${total} ${t("Records")}`}
                pageSize={max_rows}
                current={page_number}
                showSizeChanger={false}
                onChange={async (value) => {
                  set_page_number(value);
                }}
                className="dark:text-gray-200"
              />
            </div>
          )}

          {/* Modal */}
          <Modal
            open={!!openAddFormType}
            onCancel={handleAddTypeCancel}
            title={
              <span className="text-lg font-semibold text-text-skin-secondary">
                {editingType ? t("Edit Type") : t("Add Type")}
              </span>
            }
            footer={null}
            className="text-text-skin-secondary"
          >
            <Form form={form} layout="vertical">
              <Form.Item
                label={t("Name")}
                name="name"
                rules={[
                  { required: true, message: t("Please enter a name") },
                  { max: 100, message: t("Max 100 characters") },
                ]}
                className="text-text-skin-secondary"
              >
                <Input
                  placeholder={t("Enter Type name")}
                  className="h-10 bg-skin-fill-secondary border border-border-skin-base"
                />
              </Form.Item>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  onClick={handleAddTypeCancel}
                  className="h-10 dark:border-gray-600 dark:text-gray-200"
                >
                  {t("Cancel")}
                </Button>
                <Button
                  type="primary"
                  onClick={handleAddTypeSubmit}
                  loading={typeSubmitting}
                  className="h-10 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
                >
                  {editingType ? t("Update") : t("Submit")}
                </Button>
              </div>
            </Form>
          </Modal>

          {/* Bulk Upload Forms Modal */}
          <BulkUploadFormsModal
            open={isBulkUploadModalOpen}
            onClose={() => setIsBulkUploadModalOpen(false)}
            onDownloadTemplate={() => {
              download_forms_template();
            }}
            onUpload={handleBulkUpload}
          />
        </PageWrapper>
      </>
    );
  };

  export default FormWithTabs;
