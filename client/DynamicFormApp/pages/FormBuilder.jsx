import React, { useEffect, useState } from "react";
import { Formik, FieldArray } from "formik";
import * as Yup from "yup";
import { SpellCheckInput } from "@/components/SpellCheck";
import Axios from "axios";
import {
  Button,
  Card,
  Input,
  Select,
  Checkbox,
  InputNumber,
  Form as AntdForm,
  Space,
  Typography,
  Divider,
  Modal,
  Row,
  Col,
  Collapse,
  Popconfirm,
  Tooltip,
  Switch,
  Cascader,
  DatePicker,
  TimePicker,
  Radio,
  Slider,
  ColorPicker,
  Upload,
  Toast,
  Dropdown,
  NxPlus,
  NxTrash,
  NxSettings,
  NxArrowLeft,
  NxInfo,
  NxLock,
  NxUnlock,
  NxUpload,
  NxLayoutGrid,
  NxFormInput,
  NxEye,
  NxSave,
  NxFileText,
  NxMenu,
  NxChevronDown,
  NxChevronRight,
  NxGripVertical,
  NxChevronUp,
  NxArrowUp,
  NxArrowDown,
} from "@nexgensis/core";
import { useFieldTypes } from "../hooks/useFieldTypes";
import { VALIDATION_FIELD_CONFIGS } from "./validationRules";
import FieldTypeManager from "./FieldTypeManager";
import { useDataTypes } from "../hooks/useDataTypes";
import {
  create_form_fields,
  post_form_draft,
  get_form_draft,
  get_checklist_type,
} from "../api/dynamic-form-api";
import { useLocation, useNavigate, useParams } from "react-router";
import PreviewFormInBuilder from "./PreviewFormInBuilder";
import { useTranslation } from "react-i18next";
import PageWrapper from "@/components/UI/PageWrapper";
import dayjs from "dayjs";
import { baseUrl } from "@/utils/apiConfig";
const { TextArea } = Input;
import SignatureCanvas from "react-signature-canvas";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

const { RangePicker } = DatePicker;
const { Group: CheckboxGroup } = Checkbox;
const { Group: RadioGroup } = Radio;

const { Title, Text } = Typography;
const { Panel } = Collapse;

// Width options for field layout configuration
const FIELD_WIDTH_OPTIONS = [
  { label: "25% (1/4)", value: "25", span: { xs: 24, sm: 12, md: 6 } },
  { label: "33% (1/3)", value: "33", span: { xs: 24, sm: 12, md: 8 } },
  { label: "50% (1/2)", value: "50", span: { xs: 24, sm: 24, md: 12 } },
  { label: "66% (2/3)", value: "66", span: { xs: 24, sm: 24, md: 16 } },
  { label: "75% (3/4)", value: "75", span: { xs: 24, sm: 24, md: 18 } },
  { label: "100% (Full)", value: "100", span: { xs: 24, sm: 24, md: 24 } },
];

// Generate unique field name
const generateUniqueName = (prefix = "field") => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`;
};

// Validation schema for form fields
const createValidationSchema = (t) => {
  return Yup.object().shape({
    sections: Yup.array().of(
      Yup.object().shape({
        section_name: Yup.string()
          .required(t("Section name is required"))
          .min(1, t("Section name cannot be empty")),
        fields: Yup.array().of(
          Yup.object().shape({
            label: Yup.string()
              .required(t("Field label is required"))
              .min(1, t("Field label cannot be empty")),
            // name is auto-generated, no validation required
            type_id: Yup.mixed()
              .required(t("Field type is required"))
              .nullable(false),
            // Nested fields validation for table type
            fields: Yup.array().of(
              Yup.object().shape({
                label: Yup.string().when("$parentType", {
                  is: "table",
                  then: () =>
                    Yup.string().required(t("Table field label is required")),
                  otherwise: () => Yup.string(),
                }),
                // name is auto-generated for table fields too
                type_id: Yup.mixed().when("$parentType", {
                  is: "table",
                  then: () =>
                    Yup.mixed().required(t("Table field type is required")),
                  otherwise: () => Yup.mixed(),
                }),
              }),
            ),
          }),
        ),
      }),
    ),
  });
};

export default function FormBuilder() {
  const { FIELD_TYPES } = useFieldTypes();
  const [showFieldTypeManager, setShowFieldTypeManager] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const form_info = location.state || {};
  const searchParams = new URLSearchParams(location.search);
  const type = searchParams.get("type") || "create";
  const { t } = useTranslation();
  const [initial_values, set_initial_values] = useState({
    fields: [],
    sections: [],
  });
  const [formDetails, setFormDetails] = useState(null);
  const [type_list, set_type_list] = useState([]);

  // Single state object to store all dynamic options by endpoint
  const [dynamicOptionsMap, setDynamicOptionsMap] = useState({});

  const [editableFormDetails, setEditableFormDetails] = useState({
    title: "",
    description: "",
    form_type: "",
    type_id: "",
  });
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  // Debug: Log version_id sources on mount
  useEffect(() => {
    const sessionVersionId = sessionStorage.getItem(`form_version_${id}`);
  }, [id, form_info]);

  // Fetch form types on mount
  useEffect(() => {
    const success_get_checklist_type = (res) => {
      if (res.status === 200) {
        set_type_list(res.data.data);
      }
    };
    get_checklist_type(success_get_checklist_type);
  }, []);

  // Look up type_id from type_list when form_type name is available but type_id is not
  useEffect(() => {
    if (
      type_list.length > 0 &&
      editableFormDetails.form_type &&
      !editableFormDetails.type_id
    ) {
      const matchingType = type_list.find(
        (t) => t.name === editableFormDetails.form_type,
      );
      if (matchingType) {
        setEditableFormDetails((prev) => ({
          ...prev,
          type_id: matchingType.id,
        }));
      }
    }
  }, [type_list, editableFormDetails.form_type, editableFormDetails.type_id]);

  const [open, set_open] = useState(false);
  const [expandedSections, setExpandedSections] = useState([]);

  // Fetch dynamic options using the endpoint from field configuration
  const fetchDynamicOptions = async (endpoint) => {
    if (!endpoint) return;

    try {
      const token = localStorage.getItem("Token");

      const response = await Axios.get(`${baseUrl}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 200) {
        const data = response.data.data || response.data;
        setDynamicOptionsMap((prev) => ({
          ...prev,
          [endpoint]: data,
        }));
      }
    } catch (error) {
      console.error(`Error fetching options from ${endpoint}:`, error);
    }
  };

  // Normalize fields to ensure they have position values (for backward compatibility)
  // Also ensures sections have unique section_id for drag and drop
  const normalizeFieldPositions = (sections) => {
    if (!sections || !Array.isArray(sections)) return sections;

    return sections.map((section, index) => ({
      ...section,
      // Add section_id if missing (for existing sections loaded from API)
      section_id:
        section.section_id ||
        `section_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
      fields: (section.fields || [])
        // Sort by existing position if available, otherwise maintain order
        .sort((a, b) => {
          if (a.position !== undefined && b.position !== undefined) {
            return a.position - b.position;
          }
          return 0;
        })
        // Ensure each field has a position value
        .map((field, index) => ({
          ...field,
          position: field.position !== undefined ? field.position : index,
        })),
    }));
  };

  const success_get_form_fields = (res) => {
    if (res.status === 200) {
      // API response structure: res.data = { status, message, data: { draft_data, form_details } }
      const responseData = res.data?.data || res.data;
      const draftData = responseData?.draft_data || responseData;
      const formDetails = responseData?.form_details || {};

      // Try to get version_id from multiple sources in the response
      const versionId =
        formDetails?.version_id ||
        responseData?.version_id ||
        res.data?.version_id;
      if (versionId) {
        // Store in sessionStorage for persistence
        sessionStorage.setItem(`form_version_${id}`, versionId);
      }

      // Merge version_id into formDetails if found
      const mergedFormDetails = {
        ...formDetails,
        version_id: versionId || formDetails?.version_id,
      };

      setFormDetails(mergedFormDetails);
      // Debug: Log form details to see available fields
      // Initialize editable form details - check multiple possible field names for type_id
      const typeId =
        formDetails?.type_id ||
        formDetails?.form_type_id ||
        form_info?.type_id ||
        "";
      const formTitle = formDetails?.title || form_info?.title || "";
      setEditableFormDetails({
        title: formTitle,
        description: formDetails?.description || form_info?.description || "",
        form_type: formDetails?.form_type || form_info?.type || "",
        type_id: typeId,
      });

      // Store form name in sessionStorage for breadcrumb display
      if (formTitle && id) {
        sessionStorage.setItem(`form_name_${id}`, formTitle);
      }
      // Set form sections and fields data with normalized positions
      const normalizedSections = normalizeFieldPositions(
        draftData?.sections || [],
      );
      set_initial_values({
        sections: normalizedSections,
        fields: draftData?.fields || [],
      });

      // Extract unique endpoints from all dynamic fields
      const uniqueEndpoints = new Set();
      normalizedSections.forEach((section) => {
        section.fields?.forEach((field) => {
          if (field.dynamic && field.end_point) {
            uniqueEndpoints.add(field.end_point);
          }
        });
      });

      // Fetch data for each unique endpoint dynamically
      uniqueEndpoints.forEach((endpoint) => {
        fetchDynamicOptions(endpoint);
      });
    } else {
      set_initial_values({
        sections: [],
        fields: [],
      });
    }
  };

  useEffect(() => {
    if (id) {
      // Suppress toast on first load when creating a new form (no draft exists yet)
      const shouldSuppressToast = isFirstLoad && type === "create";

      get_form_draft(success_get_form_fields, { id }, null, null, {
        suppressToast: shouldSuppressToast,
      });

      // After first load, set isFirstLoad to false
      if (isFirstLoad) {
        setIsFirstLoad(false);
      }
    }
  }, [id]);

  // Custom validation function to check for duplicate field names
  const validateUniqueFieldNames = (values) => {
    const errors = {};
    const allFieldNames = [];

    values.sections?.forEach((section, sectionIndex) => {
      section.fields?.forEach((field, fieldIndex) => {
        if (field.name) {
          if (allFieldNames.includes(field.name)) {
            if (!errors.sections) errors.sections = [];
            if (!errors.sections[sectionIndex])
              errors.sections[sectionIndex] = {};
            if (!errors.sections[sectionIndex].fields)
              errors.sections[sectionIndex].fields = [];
            if (!errors.sections[sectionIndex].fields[fieldIndex])
              errors.sections[sectionIndex].fields[fieldIndex] = {};
            errors.sections[sectionIndex].fields[fieldIndex].name =
              "Field name must be unique";
          } else {
            allFieldNames.push(field.name);
          }
        }
      });
    });

    return errors;
  };

  return (
    <>
      <PageWrapper
        title={type === "edit" ? t("Edit Template") : t("Create Template")}
        subTitle={t(
          "Design and configure dynamic forms with ease. Use this interface to define fields, apply validations, group sections.",
        )}
        showBack={true}
        headerSiblingContent={
          <Button
            type="default"
            size="large"
            icon={<NxSettings />}
            onClick={() => setShowFieldTypeManager(true)}
            className="dark:!bg-blue-900 dark:!text-white dark:!border-blue-800"
          >
            {t("Manage Field Types")}
          </Button>
        }
      >
        <div className="bg-skin-card p-6 rounded-xl shadow mb-6 border border-border-skin-base">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-text-skin-secondary mb-1">
                {t("Title")}
              </label>
              <Input
                size="large"
                value={editableFormDetails.title}
                onChange={(e) =>
                  setEditableFormDetails((prev) => ({
                    ...prev,
                    title: e.target.value,
                  }))
                }
                placeholder={t("Enter form title")}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-skin-secondary mb-1">
                {t("Type")}
              </label>
              <Select
                size="large"
                value={editableFormDetails.type_id || undefined}
                onChange={(val, option) => {
                  setEditableFormDetails((prev) => ({
                    ...prev,
                    type_id: val,
                    form_type: option?.label || "",
                  }));
                }}
                options={type_list.map((i) => ({
                  label: i.name,
                  value: i.id,
                }))}
                placeholder={t("Select Type")}
                className="w-full"
                showSearch
                optionFilterProp="label"
                filterOption={(input, option) =>
                  (option?.label ?? "")
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-text-skin-secondary mb-1">
              {t("Description")}
            </label>
            <TextArea
              rows={2}
              value={editableFormDetails.description}
              onChange={(e) =>
                setEditableFormDetails((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder={t("Enter form description")}
              className="w-full"
            />
          </div>
          <div className="flex gap-4 text-sm text-text-skin-secondary">
            {formDetails?.workflow_name && (
              <span>
                <strong>{t("Workflow")}:</strong> {formDetails?.workflow_name}
              </span>
            )}
            <span>
              <strong>{t("Version")}:</strong> v{formDetails?.version || 1}
            </span>
          </div>
        </div>
        <div className="space-y-4">
          <Formik
            initialValues={initial_values}
            validationSchema={createValidationSchema(t)}
            validate={validateUniqueFieldNames}
            onSubmit={(values, { setSubmitting }) => {
              const success_create_form_fields = (res) => {
                // post() passes response.data to callback
                if (res?.status === "failed") {
                  Toast.error(res?.message || t("Failed to save form"));
                  setSubmitting(false);
                  return;
                }
                Toast.success(res?.message || t("Form saved successfully."));
                navigate("/form");
                setSubmitting(false);
              };

              const error_create_form_fields = (err) => {
                Toast.error(
                  err?.response?.data?.message ||
                    err?.message ||
                    t("Failed to save form"),
                );
                setSubmitting(false);
              };

              const sessionVersionId = sessionStorage.getItem(
                `form_version_${id}`,
              );
              const versionId =
                formDetails?.version_id ||
                form_info?.version_id ||
                sessionVersionId;
              const payload = {
                ...values,
                form_details: {
                  title: editableFormDetails.title,
                  form_type: editableFormDetails.type_id,
                  description: editableFormDetails.description,
                },
                version_id: versionId,
              };
              create_form_fields(
                success_create_form_fields,
                payload,
                id,
                error_create_form_fields,
              );
            }}
            enableReinitialize
          >
            {(formik) => (
              <AntdForm layout="vertical" onFinish={formik.handleSubmit}>
                <Card
                  className="shadow-sm"
                  styles={{
                    header: {
                      borderBottom: "1px solid #f0f0f0",
                      padding: "16px 24px",
                    },
                    body: {
                      padding: "24px",
                      overflow: "hidden",
                    },
                  }}
                  title={
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                        <NxLayoutGrid className="text-blue-600 text-xl" />
                      </div>
                      <div>
                        <Title
                          level={4}
                          style={{ margin: 0 }}
                          className="text-text-skin-base"
                        >
                          {t("Form Builder")}
                        </Title>
                        <Text
                          className="text-text-skin-secondary"
                          style={{ fontSize: "13px" }}
                        >
                          {t("Design your form sections and fields")}
                        </Text>
                      </div>
                    </div>
                  }
                >
                  <FieldArray name="sections">
                    {({ push, remove, swap }) => {
                      // Move section up
                      const moveSectionUp = (index) => {
                        if (index > 0) {
                          swap(index, index - 1);
                        }
                      };

                      // Move section down
                      const moveSectionDown = (index) => {
                        if (index < formik.values.sections.length - 1) {
                          swap(index, index + 1);
                        }
                      };

                      return (
                        <>
                          <div style={{ padding: 4 }}>
                            {formik.values.sections.map(
                              (section, sectionIndex) => {
                                const isExpanded = expandedSections.includes(
                                  sectionIndex.toString(),
                                );
                                const isFirst = sectionIndex === 0;
                                const isLast =
                                  sectionIndex ===
                                  formik.values.sections.length - 1;

                                return (
                                  <div
                                    key={
                                      section.section_id ||
                                      `section-${sectionIndex}`
                                    }
                                    style={{
                                      marginBottom: 16,
                                      background: "#fafafa",
                                      borderRadius: 12,
                                      border: "1px solid #e5e7eb",
                                      overflow: "hidden",
                                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                                    }}
                                  >
                                    {/* Section Header */}
                                    <div
                                      className="py-3 px-4"
                                      style={{
                                        background: "#fafafa",
                                        borderBottom: isExpanded
                                          ? "1px solid #e5e7eb"
                                          : "none",
                                      }}
                                    >
                                      <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-4">
                                          <div className="flex items-center gap-3">
                                            {/* Move Up/Down Buttons */}
                                            <div className="flex flex-col gap-0.5">
                                              <Tooltip title={t("Move Up")}>
                                                <Button
                                                  type="text"
                                                  size="small"
                                                  icon={
                                                    <NxChevronUp size={14} />
                                                  }
                                                  onClick={() =>
                                                    moveSectionUp(sectionIndex)
                                                  }
                                                  disabled={isFirst}
                                                  style={{
                                                    padding: "2px 6px",
                                                    height: 20,
                                                    opacity: isFirst ? 0.3 : 1,
                                                  }}
                                                />
                                              </Tooltip>
                                              <Tooltip title={t("Move Down")}>
                                                <Button
                                                  type="text"
                                                  size="small"
                                                  icon={
                                                    <NxChevronDown size={14} />
                                                  }
                                                  onClick={() =>
                                                    moveSectionDown(
                                                      sectionIndex,
                                                    )
                                                  }
                                                  disabled={isLast}
                                                  style={{
                                                    padding: "2px 6px",
                                                    height: 20,
                                                    opacity: isLast ? 0.3 : 1,
                                                  }}
                                                />
                                              </Tooltip>
                                            </div>
                                            {/* Section Number */}
                                            <div
                                              className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-600 text-white font-bold text-sm"
                                              style={{ minWidth: 40 }}
                                            >
                                              {sectionIndex + 1}
                                            </div>
                                            {/* Section Name Input */}
                                            <div
                                              style={{
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: 2,
                                              }}
                                            >
                                              <Text
                                                strong
                                                className="text-text-skin-base text-xs uppercase tracking-wide"
                                                style={{ opacity: 0.7 }}
                                              >
                                                {t("Section Name")}
                                              </Text>
                                              <SpellCheckInput
                                                name={`sections.${sectionIndex}.section_name`}
                                                value={
                                                  formik.values.sections[
                                                    sectionIndex
                                                  ]?.section_name || ""
                                                }
                                                onChange={formik.handleChange}
                                                onBlur={formik.handleBlur}
                                                placeholder={t(
                                                  "Enter section name",
                                                )}
                                                style={{
                                                  width: 240,
                                                  borderRadius: 8,
                                                }}
                                                status={
                                                  formik.errors.sections?.[
                                                    sectionIndex
                                                  ]?.section_name &&
                                                  formik.touched.sections?.[
                                                    sectionIndex
                                                  ]?.section_name
                                                    ? "error"
                                                    : ""
                                                }
                                              />
                                              {formik.errors.sections?.[
                                                sectionIndex
                                              ]?.section_name &&
                                                formik.touched.sections?.[
                                                  sectionIndex
                                                ]?.section_name && (
                                                  <Text
                                                    type="danger"
                                                    style={{ fontSize: "11px" }}
                                                  >
                                                    {
                                                      formik.errors.sections[
                                                        sectionIndex
                                                      ].section_name
                                                    }
                                                  </Text>
                                                )}
                                            </div>
                                          </div>
                                          {/* Section Dependency */}
                                          <div
                                            style={{
                                              display: "flex",
                                              flexDirection: "column",
                                              gap: 2,
                                              marginLeft: 16,
                                            }}
                                          >
                                            <Space
                                              direction="horizontal"
                                              align="center"
                                              size={4}
                                            >
                                              <Text
                                                strong
                                                className="text-text-skin-base text-xs uppercase tracking-wide"
                                                style={{ opacity: 0.7 }}
                                              >
                                                {t("Section Dependency")}
                                              </Text>
                                              <Tooltip
                                                title={t(
                                                  "Configure when this section should be visible. Select Section → Field → Options.",
                                                )}
                                              >
                                                <NxInfo
                                                  className="text-blue-600"
                                                  style={{ fontSize: 12 }}
                                                />
                                              </Tooltip>
                                            </Space>
                                            <SectionDependencyCascader
                                              sectionIndex={sectionIndex}
                                              formik={formik}
                                            />
                                          </div>
                                        </div>
                                        {/* Action Buttons */}
                                        <div
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 4,
                                          }}
                                        >
                                          <Tooltip
                                            title={
                                              isExpanded
                                                ? t("Collapse")
                                                : t("Expand")
                                            }
                                          >
                                            <Button
                                              type="text"
                                              icon={
                                                isExpanded ? (
                                                  <NxChevronDown />
                                                ) : (
                                                  <NxChevronRight />
                                                )
                                              }
                                              onClick={() => {
                                                if (isExpanded) {
                                                  setExpandedSections(
                                                    expandedSections.filter(
                                                      (k) =>
                                                        k !==
                                                        sectionIndex.toString(),
                                                    ),
                                                  );
                                                } else {
                                                  setExpandedSections([
                                                    ...expandedSections,
                                                    sectionIndex.toString(),
                                                  ]);
                                                }
                                              }}
                                              className="hover:bg-gray-100 dark:hover:bg-gray-700"
                                              style={{ borderRadius: 8 }}
                                            />
                                          </Tooltip>
                                          <Popconfirm
                                            title={t(
                                              "Are you sure to delete this section?",
                                            )}
                                            onConfirm={() =>
                                              remove(sectionIndex)
                                            }
                                            okText={t("Yes")}
                                            cancelText={t("No")}
                                            okButtonProps={{ danger: true }}
                                          >
                                            <Button
                                              type="text"
                                              danger
                                              icon={<NxTrash />}
                                              className="hover:bg-red-50 dark:hover:bg-red-900/20"
                                              style={{ borderRadius: 8 }}
                                            />
                                          </Popconfirm>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Section Content (Fields) - Collapsible */}
                                    {isExpanded && (
                                      <div
                                        className="p-4"
                                        style={{ background: "#fff" }}
                                      >
                                        <SectionFieldsEditor
                                          sectionIndex={sectionIndex}
                                          formik={formik}
                                          fieldTypes={FIELD_TYPES}
                                          dynamicOptionsMap={dynamicOptionsMap}
                                          fetchDynamicOptions={
                                            fetchDynamicOptions
                                          }
                                        />
                                      </div>
                                    )}
                                  </div>
                                );
                              },
                            )}
                          </div>

                          <Button
                            type="dashed"
                            icon={<NxPlus />}
                            onClick={() =>
                              push({
                                section_id: `section_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                section_name: "",
                                fields: [],
                                dependency: {
                                  field_section: "",
                                  field_name: "",
                                  options_selected: [],
                                  cascader_selection: [],
                                  multiple_field_dependencies: [],
                                },
                              })
                            }
                            style={{
                              marginTop: 16,
                              height: 48,
                              borderRadius: 8,
                            }}
                            className="w-full"
                            block
                          >
                            {t("Add New Section")}
                          </Button>
                        </>
                      );
                    }}
                  </FieldArray>
                </Card>

                <div
                  className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-6 px-0 py-4"
                  style={{ borderRadius: "0 0 12px 12px" }}
                >
                  <div className="flex justify-between items-center">
                    <Text className="text-gray-500 dark:text-gray-400 text-sm">
                      {formik.values.sections?.length || 0} {t("sections")} •{" "}
                      {formik.values.sections?.reduce(
                        (acc, s) => acc + (s.fields?.length || 0),
                        0,
                      ) || 0}{" "}
                      {t("fields")}
                    </Text>
                    <Space size="middle">
                      <Button
                        icon={<NxEye />}
                        onClick={() => set_open(true)}
                        style={{
                          borderRadius: 6,
                          height: 36,
                        }}
                      >
                        {t("Preview")}
                      </Button>
                      <Button
                        icon={<NxSave />}
                        onClick={() => {
                          const success_post_form_draft = (res) => {
                            // post() passes response.data to callback
                            if (res?.status === "failed") {
                              Toast.error(
                                res?.message || t("Failed to save draft"),
                              );
                              return;
                            }
                            Toast.success(
                              res?.message ||
                                t("Form draft saved successfully."),
                            );
                          };
                          const sessionVersionId = sessionStorage.getItem(
                            `form_version_${id}`,
                          );
                          const versionId =
                            formDetails?.version_id ||
                            form_info?.version_id ||
                            sessionVersionId;
                          post_form_draft(
                            success_post_form_draft,
                            {
                              draft_data: formik.values,
                              form_details: {
                                title: editableFormDetails.title,
                                form_type: editableFormDetails.type_id,
                                description: editableFormDetails.description,
                              },
                              version_id: versionId,
                            },
                            id,
                          );
                        }}
                        style={{
                          borderRadius: 6,
                          height: 36,
                        }}
                      >
                        {t("Save Draft")}
                      </Button>
                      <Button
                        type="primary"
                        icon={<NxFileText />}
                        onClick={formik.handleSubmit}
                        loading={formik.isSubmitting}
                        disabled={!formik.isValid || formik.isSubmitting}
                        style={{
                          borderRadius: 6,
                          height: 36,
                        }}
                      >
                        {t("Submit Form")}
                      </Button>
                    </Space>
                  </div>
                </div>
                <Modal
                  title={
                    <div className="flex items-center gap-2">
                      <NxEye className="text-blue-600" />
                      <span>{t("Form Preview")}</span>
                    </div>
                  }
                  open={open}
                  onCancel={() => set_open(false)}
                  footer={null}
                  width={1200}
                  destroyOnHidden
                  zIndex={2000}
                  styles={{
                    header: {
                      borderBottom: "1px solid #f0f0f0",
                      paddingBottom: 16,
                    },
                  }}
                >
                  <PreviewFormInBuilder formSchema={formik.values} />
                </Modal>
              </AntdForm>
            )}
          </Formik>
        </div>
      </PageWrapper>
      <Modal
        open={showFieldTypeManager}
        onCancel={() => setShowFieldTypeManager(false)}
        footer={null}
        width={900}
      >
        <FieldTypeManager />
      </Modal>
    </>
  );
}

function SectionDependencyCascader({ sectionIndex, formik }) {
  const { t } = useTranslation();
  const basePath = `sections.${sectionIndex}`;

  const getNestedValue = (obj, path) => {
    return path.split(".").reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  };

  // Build cascader options from all sections and their fields with options
  const buildCascaderOptions = () => {
    const options = [];

    formik.values.sections?.forEach((section, idx) => {
      // Get fields that have options (static or dynamic)
      const fieldsWithOptions =
        section.fields?.filter((field) => {
          // Include fields with static options
          const hasStaticOptions = field.options && field.options.length > 0;
          // Include dynamic fields that fetch options from API
          const hasDynamicOptions = field.dynamic && field.end_point;
          return hasStaticOptions || hasDynamicOptions;
        }) || [];

      // Only add section if it has fields with options and it's not the current section
      if (fieldsWithOptions.length > 0 && idx !== sectionIndex) {
        const sectionOption = {
          label: `📁 ${section.section_name || `Section ${idx + 1}`}`,
          value: section.section_name || `Section ${idx + 1}`,
          children: fieldsWithOptions.map((field) => ({
            label: `📋 ${field.label || field.name}`,
            value: field.name,
            children:
              field.options
                ?.filter(
                  (option) =>
                    option !== null && option !== undefined && option !== "",
                )
                ?.map((option) => ({
                  label: `✓ ${typeof option === "object" ? option.label : option}`,
                  value: typeof option === "object" ? option.value : option,
                })) || [],
          })),
        };
        options.push(sectionOption);
      }
    });

    return options;
  };

  const handleDependencyChange = (value) => {
    // Update the cascader selection
    formik.setFieldValue(`${basePath}.dependency.cascader_selection`, value);

    if (value && value.length > 0) {
      // Group by section and field, collect all options
      const pathsByField = {};
      value.forEach((path) => {
        if (path.length >= 3) {
          const [section, field, option] = path;
          const key = `${section}|${field}`;
          if (!pathsByField[key]) {
            pathsByField[key] = {
              section,
              field,
              options: [],
            };
          }
          pathsByField[key].options.push(option);
        }
      });

      // Store multiple field dependencies
      const multipleFieldDependencies = Object.keys(pathsByField).map((key) => {
        const fieldData = pathsByField[key];
        return {
          field_section: fieldData.section,
          field_name: fieldData.field,
          options_selected: fieldData.options,
        };
      });

      formik.setFieldValue(
        `${basePath}.dependency.multiple_field_dependencies`,
        multipleFieldDependencies,
      );

      // For backward compatibility
      if (multipleFieldDependencies.length > 0) {
        const firstDep = multipleFieldDependencies[0];
        formik.setFieldValue(
          `${basePath}.dependency.field_section`,
          firstDep.field_section,
        );
        formik.setFieldValue(
          `${basePath}.dependency.field_name`,
          firstDep.field_name,
        );
        formik.setFieldValue(
          `${basePath}.dependency.options_selected`,
          firstDep.options_selected,
        );
      }
    } else {
      // Clear all dependency fields
      formik.setFieldValue(`${basePath}.dependency.field_section`, "");
      formik.setFieldValue(`${basePath}.dependency.field_name`, "");
      formik.setFieldValue(`${basePath}.dependency.options_selected`, []);
      formik.setFieldValue(
        `${basePath}.dependency.multiple_field_dependencies`,
        [],
      );
    }
  };

  const getCurrentValue = () => {
    const cascaderSelection = getNestedValue(
      formik.values,
      `${basePath}.dependency.cascader_selection`,
    );

    if (cascaderSelection && cascaderSelection.length > 0) {
      return cascaderSelection;
    }

    // Build from individual fields if cascader selection is empty
    const multipleFieldDeps =
      getNestedValue(
        formik.values,
        `${basePath}.dependency.multiple_field_dependencies`,
      ) || [];

    if (multipleFieldDeps.length > 0) {
      const cascaderPaths = [];
      multipleFieldDeps.forEach((dep) => {
        dep.options_selected.forEach((option) => {
          cascaderPaths.push([dep.field_section, dep.field_name, option]);
        });
      });
      return cascaderPaths;
    }

    const fieldSection = getNestedValue(
      formik.values,
      `${basePath}.dependency.field_section`,
    );
    const fieldName = getNestedValue(
      formik.values,
      `${basePath}.dependency.field_name`,
    );
    const optionsSelected =
      getNestedValue(
        formik.values,
        `${basePath}.dependency.options_selected`,
      ) || [];

    if (fieldSection && fieldName && optionsSelected.length > 0) {
      return optionsSelected.map((option) => [fieldSection, fieldName, option]);
    }

    return [];
  };

  const cascaderOptions = buildCascaderOptions();

  return (
    <Cascader
      style={{
        minWidth: 280,
        borderRadius: 8,
      }}
      value={getCurrentValue()}
      onChange={handleDependencyChange}
      options={cascaderOptions}
      multiple
      maxTagCount={2}
      placeholder={
        cascaderOptions.length === 0
          ? t("No fields with options available")
          : t("Select: Section → Field → Option")
      }
      allowClear
      showSearch={{
        filter: (inputValue, path) =>
          path.some((option) =>
            option.label.toLowerCase().includes(inputValue.toLowerCase()),
          ),
      }}
      displayRender={(labels) => {
        if (labels.length === 3) {
          // Remove emojis for cleaner display in tags
          const cleanLabels = labels.map((l) =>
            l.replace(/^(📁|📋|✓)\s*/u, ""),
          );
          return `${cleanLabels[2]} (${cleanLabels[1]})`;
        }
        return labels.join(" → ");
      }}
      notFoundContent={
        <div className="text-center py-4 text-gray-500 dark:text-gray-400">
          <p className="text-sm">{t("No options available")}</p>
          <p className="text-xs mt-1">
            {t("Add options to Select, Radio, or Checkbox fields first")}
          </p>
        </div>
      }
      dropdownRender={(menus) => (
        <div>
          <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400">
            {t("Select: Section → Field → Option")}
          </div>
          {menus}
        </div>
      )}
    />
  );
}

function SectionFieldsEditor({
  sectionIndex,
  formik,
  fieldTypes = [],
  dynamicOptionsMap = {},
  fetchDynamicOptions,
}) {
  const fields = formik.values.sections[sectionIndex]?.fields || [];
  const { t } = useTranslation();
  const [availableFieldGroups, setAvailableFieldGroups] = useState([]);
  const [selectedFieldGroups, setSelectedFieldGroups] = useState([]);
  const [searchText, setSearchText] = useState("");

  // Load Field Groups from localStorage
  const loadFieldGroups = () => {
    try {
      const groups = JSON.parse(
        localStorage.getItem("field_group_templates") || "[]",
      );
      setAvailableFieldGroups(groups);
    } catch {
      setAvailableFieldGroups([]);
    }
  };

  useEffect(() => {
    loadFieldGroups();
    window.addEventListener("fieldGroupsUpdated", loadFieldGroups);
    return () =>
      window.removeEventListener("fieldGroupsUpdated", loadFieldGroups);
  }, []);

  // Detect existing field groups in the form and update selectedFieldGroups
  useEffect(() => {
    const existingGroupIds = new Set();
    fields.forEach((field) => {
      if (field.field_group_id) {
        existingGroupIds.add(field.field_group_id);
      }
    });
    setSelectedFieldGroups(Array.from(existingGroupIds));
  }, [fields]);

  const addField = () => {
    const currentFields = formik.values.sections[sectionIndex]?.fields || [];
    const newField = {
      label: "",
      name: generateUniqueName("field"),
      type: "",
      type_id: null,
      required: false,
      validation: {},
      options: [],
      fields: [],
      width: "33", // Default width 33% (1/3 of row)
      position: currentFields.length, // Explicit position based on current array length
      dependency: {
        field_section: "",
        field_name: "",
        options_selected: [],
        cascader_selection: [],
        multiple_field_dependencies: [],
      },
    };
    formik.setFieldValue(`sections.${sectionIndex}.fields`, [
      ...currentFields,
      newField,
    ]);
  };

  const removeField = (fieldIndex) => {
    const currentFields = formik.values.sections[sectionIndex]?.fields || [];
    const newFields = currentFields
      .filter((_, index) => index !== fieldIndex)
      .map((field, index) => ({
        ...field,
        position: index, // Recalculate positions after removal
      }));
    formik.setFieldValue(`sections.${sectionIndex}.fields`, newFields);
  };

  // Move field up within section
  const moveFieldUp = (fieldIndex) => {
    if (fieldIndex > 0) {
      const currentFields = [...fields];
      const temp = currentFields[fieldIndex];
      currentFields[fieldIndex] = currentFields[fieldIndex - 1];
      currentFields[fieldIndex - 1] = temp;
      // Update positions
      const updatedFields = currentFields.map((field, index) => ({
        ...field,
        position: index,
      }));
      formik.setFieldValue(`sections.${sectionIndex}.fields`, updatedFields);
    }
  };

  // Move field down within section
  const moveFieldDown = (fieldIndex) => {
    if (fieldIndex < fields.length - 1) {
      const currentFields = [...fields];
      const temp = currentFields[fieldIndex];
      currentFields[fieldIndex] = currentFields[fieldIndex + 1];
      currentFields[fieldIndex + 1] = temp;
      // Update positions
      const updatedFields = currentFields.map((field, index) => ({
        ...field,
        position: index,
      }));
      formik.setFieldValue(`sections.${sectionIndex}.fields`, updatedFields);
    }
  };

  // Toggle field group (add/remove)
  const toggleFieldGroup = (fieldGroup) => {
    if (
      !fieldGroup ||
      !fieldGroup.sections ||
      fieldGroup.sections.length === 0
    ) {
      Toast.error(t("Field Group has no fields"));
      return;
    }

    const currentFields = formik.values.sections[sectionIndex]?.fields || [];
    const isSelected = selectedFieldGroups.includes(fieldGroup.id);

    if (isSelected) {
      const filteredFields = currentFields
        .filter((field) => field.field_group_id !== fieldGroup.id)
        .map((field, index) => ({
          ...field,
          position: index,
        }));
      formik.setFieldValue(`sections.${sectionIndex}.fields`, filteredFields);
      setSelectedFieldGroups((prev) =>
        prev.filter((id) => id !== fieldGroup.id),
      );
      Toast.success(t("Field Group removed"));
    } else {
      const fieldGroupFields = fieldGroup.sections.flatMap(
        (section) => section.fields || [],
      );
      if (fieldGroupFields.length === 0) {
        Toast.error(t("Field Group has no fields"));
        return;
      }
      const currentSectionName =
        formik.values.sections[sectionIndex]?.section_name ||
        `Section ${sectionIndex + 1}`;

      const newFields = fieldGroupFields.map((field, index) => {
        const newField = JSON.parse(JSON.stringify(field));
        newField.field_group_id = fieldGroup.id;
        newField.position = currentFields.length + index;

        if (!newField.dependency) {
          newField.dependency = {
            field_section: "",
            field_name: "",
            options_selected: [],
            cascader_selection: [],
            multiple_field_dependencies: [],
          };
        } else {
          // Update dependency section references to current section
          if (newField.dependency.field_section) {
            newField.dependency.field_section = currentSectionName;
          }

          // Update cascader_selection section references
          if (
            newField.dependency.cascader_selection &&
            Array.isArray(newField.dependency.cascader_selection)
          ) {
            newField.dependency.cascader_selection =
              newField.dependency.cascader_selection.map((path) => {
                if (Array.isArray(path) && path.length === 3) {
                  return [currentSectionName, path[1], path[2]];
                }
                return path;
              });
          }

          // Update multiple_field_dependencies section references
          if (
            newField.dependency.multiple_field_dependencies &&
            Array.isArray(newField.dependency.multiple_field_dependencies)
          ) {
            newField.dependency.multiple_field_dependencies =
              newField.dependency.multiple_field_dependencies.map((dep) => ({
                ...dep,
                field_section: currentSectionName,
              }));
          }
        }

        return newField;
      });
      formik.setFieldValue(`sections.${sectionIndex}.fields`, [
        ...currentFields,
        ...newFields,
      ]);
      setSelectedFieldGroups((prev) => [...prev, fieldGroup.id]);
      Toast.success(t("Field Group added"));
    }
  };

  const fieldGroupsMap = new Map();
  fields.forEach((field, index) => {
    if (field.field_group_id) {
      if (!fieldGroupsMap.has(field.field_group_id)) {
        fieldGroupsMap.set(field.field_group_id, []);
      }
      fieldGroupsMap.get(field.field_group_id).push({ field, index });
    }
  });

  const removeFieldGroup = (fieldGroupId) => {
    const updatedFields = fields.filter(
      (field) => field.field_group_id !== fieldGroupId,
    );
    formik.setFieldValue(`sections.${sectionIndex}.fields`, updatedFields);
    setSelectedFieldGroups((prev) => prev.filter((id) => id !== fieldGroupId));
    Toast.success(t("Field Group deleted"));
  };

  const moveGroupUp = (fieldGroupId) => {
    const groupFields = fields.filter((f) => f.field_group_id === fieldGroupId);
    if (groupFields.length === 0) return;
    const firstFieldIndex = fields.findIndex(
      (f) => f.field_group_id === fieldGroupId,
    );
    if (firstFieldIndex === 0) return;
    const currentFields = [...fields];
    const filteredFields = currentFields.filter(
      (f) => f.field_group_id !== fieldGroupId,
    );
    const insertAt = Math.max(0, firstFieldIndex - 1);
    filteredFields.splice(insertAt, 0, ...groupFields);
    const updatedFields = filteredFields.map((field, index) => ({
      ...field,
      position: index,
    }));
    formik.setFieldValue(`sections.${sectionIndex}.fields`, updatedFields);
  };

  const moveGroupDown = (fieldGroupId) => {
    const groupFields = fields.filter((f) => f.field_group_id === fieldGroupId);
    if (groupFields.length === 0) return;
    const firstFieldIndex = fields.findIndex(
      (f) => f.field_group_id === fieldGroupId,
    );
    const lastFieldIndex = firstFieldIndex + groupFields.length - 1;
    if (lastFieldIndex >= fields.length - 1) return;
    const currentFields = [...fields];
    const filteredFields = currentFields.filter(
      (f) => f.field_group_id !== fieldGroupId,
    );
    const insertAt = Math.min(filteredFields.length, firstFieldIndex + 1);
    filteredFields.splice(insertAt, 0, ...groupFields);
    const updatedFields = filteredFields.map((field, index) => ({
      ...field,
      position: index,
    }));
    formik.setFieldValue(`sections.${sectionIndex}.fields`, updatedFields);
  };

  return (
    <>
      <div style={{ minHeight: fields.length === 0 ? 60 : "auto" }}>
        {fields.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "20px",
              color: "#999",
              fontSize: "13px",
              border: "2px dashed #e5e7eb",
              borderRadius: 8,
            }}
          >
            {t("No fields yet. Click 'Add Field' to add a field.")}
          </div>
        )}
        {(() => {
          const renderedGroupIds = new Set();
          let sequenceNumber = 0;
          return fields.map((field, fieldIndex) => {
            if (
              field.field_group_id &&
              !renderedGroupIds.has(field.field_group_id)
            ) {
              renderedGroupIds.add(field.field_group_id);
              sequenceNumber++;
              const groupFields =
                fieldGroupsMap.get(field.field_group_id) || [];
              const fieldGroup = availableFieldGroups.find(
                (g) => g.id === field.field_group_id,
              );
              const groupName = fieldGroup?.title || "Field Group";
              const groupNumber = sequenceNumber;

              return (
                <div
                  key={field.field_group_id}
                  style={{
                    marginBottom: 16,
                    border: "1px solid #e8e8e8",
                    borderRadius: "6px",
                    padding: "16px",
                    background: "#fafafa",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 12,
                      paddingBottom: 8,
                      borderBottom: "1px solid #e8e8e8",
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <div className="flex flex-col gap-0.5">
                        <Tooltip title={t("Move Up")}>
                          <Button
                            type="text"
                            size="small"
                            icon={<NxChevronUp size={12} />}
                            onClick={() => moveGroupUp(field.field_group_id)}
                            disabled={fieldIndex === 0}
                            style={{
                              padding: "1px 4px",
                              height: 16,
                              opacity: fieldIndex === 0 ? 0.3 : 1,
                            }}
                          />
                        </Tooltip>
                        <Tooltip title={t("Move Down")}>
                          <Button
                            type="text"
                            size="small"
                            icon={<NxChevronDown size={12} />}
                            onClick={() => moveGroupDown(field.field_group_id)}
                            disabled={
                              fieldIndex + groupFields.length >= fields.length
                            }
                            style={{
                              padding: "1px 4px",
                              height: 16,
                              opacity:
                                fieldIndex + groupFields.length >= fields.length
                                  ? 0.3
                                  : 1,
                            }}
                          />
                        </Tooltip>
                      </div>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-600 text-white text-xs font-semibold">
                        {groupNumber}
                      </div>
                      <NxLayoutGrid size={18} style={{ color: "#1890ff" }} />
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: 14,
                          color: "#262626",
                        }}
                      >
                        {groupName}
                      </span>
                      <span style={{ fontSize: 12, color: "#8c8c8c" }}>
                        ({groupFields.length} fields)
                      </span>
                    </div>
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<NxTrash size={16} />}
                      onClick={() => removeFieldGroup(field.field_group_id)}
                      style={{ fontSize: 12 }}
                    >
                      {t("Remove")}
                    </Button>
                  </div>
                  {groupFields.map(
                    ({ field: groupField, index: groupFieldIndex }) => {
                      const isFirst = groupFieldIndex === 0;
                      const isLast = groupFieldIndex === fields.length - 1;
                      const displayNumber = groupFieldIndex + 1;
                      return (
                        <div key={groupFieldIndex} style={{ marginBottom: 8 }}>
                          <FieldEditor
                            field={groupField}
                            fieldIndex={groupFieldIndex}
                            sectionIndex={sectionIndex}
                            onRemove={() => removeField(groupFieldIndex)}
                            formik={formik}
                            fieldTypes={fieldTypes}
                            onMoveUp={() => moveFieldUp(groupFieldIndex)}
                            onMoveDown={() => moveFieldDown(groupFieldIndex)}
                            isFirst={isFirst}
                            isLast={isLast}
                            dynamicOptionsMap={dynamicOptionsMap}
                            fetchDynamicOptions={fetchDynamicOptions}
                            hideNumber={true}
                            displayNumber={displayNumber}
                          />
                        </div>
                      );
                    },
                  )}
                </div>
              );
            } else if (!field.field_group_id) {
              sequenceNumber++;
              const isFirst = fieldIndex === 0;
              const isLast = fieldIndex === fields.length - 1;
              const displayNumber = sequenceNumber;

              return (
                <div
                  key={field.name || `field-${sectionIndex}-${fieldIndex}`}
                  style={{ marginBottom: 8 }}
                >
                  <FieldEditor
                    field={field}
                    fieldIndex={fieldIndex}
                    sectionIndex={sectionIndex}
                    onRemove={() => removeField(fieldIndex)}
                    formik={formik}
                    fieldTypes={fieldTypes}
                    onMoveUp={() => moveFieldUp(fieldIndex)}
                    onMoveDown={() => moveFieldDown(fieldIndex)}
                    isFirst={isFirst}
                    isLast={isLast}
                    dynamicOptionsMap={dynamicOptionsMap}
                    fetchDynamicOptions={fetchDynamicOptions}
                    hideNumber={false}
                    displayNumber={displayNumber}
                  />
                </div>
              );
            }
            return null;
          });
        })()}
      </div>

      <div style={{ display: "flex", gap: "12px", marginTop: 12 }}>
        <Button
          type="dashed"
          icon={<NxPlus />}
          onClick={addField}
          style={{ height: 40, borderRadius: 8, flex: 1 }}
        >
          {t("Add Field")}
        </Button>

        <Dropdown
          dropdownRender={(menu) => (
            <div
              style={{
                minWidth: 280,
                background: "#fff",
                borderRadius: 8,
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              }}
            >
              <div style={{ padding: "12px 12px 8px" }}>
                <Input
                  placeholder={t("Search...")}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  allowClear
                  style={{ borderRadius: 6 }}
                />
              </div>
              <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 4 }}>
                {menu}
              </div>
            </div>
          )}
          menu={{
            items: (() => {
              const filteredGroups = availableFieldGroups.filter((group) =>
                group.title.toLowerCase().includes(searchText.toLowerCase()),
              );
              return filteredGroups.length === 0
                ? [
                    {
                      key: "empty",
                      label: (
                        <div
                          style={{
                            padding: "12px",
                            textAlign: "center",
                            color: "#999",
                          }}
                        >
                          {searchText ? t("No results") : t("No groups")}
                        </div>
                      ),
                      disabled: true,
                    },
                  ]
                : filteredGroups.map((group) => {
                    const fieldCount =
                      group.sections?.reduce(
                        (total, section) =>
                          total + (section.fields?.length || 0),
                        0,
                      ) || 0;
                    const hasFields = fieldCount > 0;
                    const isSelected = selectedFieldGroups.includes(group.id);
                    return {
                      key: group.id,
                      disabled: !hasFields,
                      label: (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "4px 0",
                          }}
                        >
                          <Checkbox checked={isSelected} />
                          <span style={{ fontSize: 14 }}>
                            {group.title}{" "}
                            <span style={{ color: "#999", fontSize: 13 }}>
                              ({fieldCount})
                            </span>
                          </span>
                        </div>
                      ),
                      onClick: () => hasFields && toggleFieldGroup(group),
                    };
                  });
            })(),
          }}
          trigger={["click"]}
          placement="bottomRight"
        >
          <Button
            type="dashed"
            icon={<NxPlus />}
            style={{ height: 40, borderRadius: 8, flex: 1 }}
          >
            {t("Add Field Group")}
          </Button>
        </Dropdown>
      </div>
    </>
  );
}

function DynamicValidationRules({
  basePath,
  fieldType,
  formik,
  fieldTypes = [],
  dynamicOptionsMap = {},
  isTableColumn = false,
  tableColumns = [],
  currentColumnIndex = -1,
  sectionIndex = -1,
  fieldIndex = -1,
}) {
  const DATA_TYPES = useDataTypes();
  const dataType = DATA_TYPES.find((dt) => dt.type === fieldType);
  const { t } = useTranslation();
  if (!dataType) return null;

  const getNestedValue = (obj, path) => {
    return path.split(".").reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  };

  // Check if field is dynamic with {id} placeholder
  const endPoint = getNestedValue(formik.values, `${basePath}.end_point`) || "";
  const isDynamic =
    getNestedValue(formik.values, `${basePath}.dynamic`) || false;
  const hasPlaceholder = endPoint.includes("{id}");
  const showApiDependency = isDynamic && hasPlaceholder;

  // Get available dependency fields - show all fields with hierarchy
  let availableDependencyFields = [];
  const sections = formik.values.sections || [];

  sections.forEach((section, secIdx) => {
    const sectionLabel = section.title || `Section ${secIdx + 1}`;

    (section.fields || []).forEach((field, fldIdx) => {
      // For normal fields: exclude self
      if (!isTableColumn && secIdx === sectionIndex && fldIdx === fieldIndex)
        return;

      const fieldType = field.type;
      const isMultiple = field.validation?.isMultiple;

      // Add normal single-select fields as "Section → Field"
      if ((fieldType === "select" || fieldType === "radio") && !isMultiple) {
        availableDependencyFields.push({
          label: `${sectionLabel} → ${field.label || field.name}`,
          value: field.name,
        });
      }

      // If it's a table field, show its columns as "Section → Table → Column"
      if (fieldType === "table" && field.fields) {
        const tableLabel = field.label || field.name;
        (field.fields || []).forEach((col, colIdx) => {
          // For table columns: exclude columns from the same table
          if (
            isTableColumn &&
            secIdx === sectionIndex &&
            fldIdx === fieldIndex &&
            colIdx === currentColumnIndex
          ) {
            return;
          }

          const colType = col.type;
          const colIsMultiple = col.validation?.isMultiple;

          // Only show single-select columns
          if ((colType === "select" || colType === "radio") && !colIsMultiple) {
            availableDependencyFields.push({
              label: `${sectionLabel} → ${tableLabel} → ${col.label || col.name}`,
              value: col.name,
            });
          }
        });
      }
    });
  });

  return (
    <Row gutter={16}>
      {dataType.validation_rules.map((rule) => {
        const config = VALIDATION_FIELD_CONFIGS[rule];
        if (!config) return null;

        const fieldPath = `${basePath}.validation.${rule}`;
        const fieldValue =
          getNestedValue(formik.values, fieldPath) ?? config.defaultValue;

        // Show min/max selection only if Multiple Selection is enabled
        const isMultiple =
          getNestedValue(formik.values, `${basePath}.validation.isMultiple`) ??
          VALIDATION_FIELD_CONFIGS.isMultiple.defaultValue;
        if (
          (rule === "minSelection" || rule === "maxSelection") &&
          !isMultiple
        ) {
          return null;
        }
        return (
          <Col span={4} key={rule}>
            <AntdForm.Item label={config.label}>
              {config.type === "number" ? (
                <InputNumber
                  name={fieldPath}
                  value={fieldValue}
                  onChange={(value) => formik.setFieldValue(fieldPath, value)}
                  min={config.min}
                  style={{ width: "100%" }}
                />
              ) : config.type === "checkbox" ? (
                <Checkbox
                  checked={!!fieldValue}
                  onChange={(e) => {
                    // Prevent enabling multiple selection if API dependency is enabled
                    if (rule === "isMultiple" && e.target.checked) {
                      const hasApiDependency = getNestedValue(
                        formik.values,
                        `${basePath}.validation.apiDependency.enabled`,
                      );
                      if (hasApiDependency) {
                        Toast.warning(
                          "Cannot enable multiple selection when API dependency is enabled",
                        );
                        return;
                      }
                    }
                    formik.setFieldValue(fieldPath, e.target.checked);
                  }}
                >
                  {config.label}
                </Checkbox>
              ) : config.type === "date" ? (
                <Input
                  name={fieldPath}
                  value={fieldValue || ""}
                  onChange={formik.handleChange}
                  type="date"
                  style={{ width: "100%" }}
                />
              ) : config.type === "time" ? (
                <Input
                  name={fieldPath}
                  value={fieldValue || ""}
                  onChange={formik.handleChange}
                  type="time"
                  style={{ width: "100%" }}
                />
              ) : (
                <Input
                  name={fieldPath}
                  value={fieldValue || ""}
                  onChange={formik.handleChange}
                  placeholder={config.placeholder}
                  style={{ width: "100%" }}
                />
              )}
            </AntdForm.Item>
          </Col>
        );
      })}
      <Col span={4}>
        <AntdForm.Item label={t("Error Message")}>
          <Input
            name={`${basePath}.validation.errorMessage`}
            value={
              getNestedValue(
                formik.values,
                `${basePath}.validation.errorMessage`,
              ) || ""
            }
            onChange={formik.handleChange}
            placeholder={t("Error Message")}
          />
        </AntdForm.Item>
      </Col>
      {
        <>
          <Col span={4}>
            <AntdForm.Item label={t("API Dependency")}>
              <Checkbox
                checked={
                  !!getNestedValue(
                    formik.values,
                    `${basePath}.validation.apiDependency.enabled`,
                  )
                }
                onChange={(e) => {
                  formik.setFieldValue(
                    `${basePath}.validation.apiDependency.enabled`,
                    e.target.checked,
                  );
                  if (!e.target.checked) {
                    formik.setFieldValue(
                      `${basePath}.validation.apiDependency.dependsOn`,
                      "",
                    );
                  }
                  // Prevent enabling API dependency if multiple selection is enabled
                  if (e.target.checked) {
                    const isMultiple = getNestedValue(
                      formik.values,
                      `${basePath}.validation.isMultiple`,
                    );
                    if (isMultiple) {
                      Toast.warning(
                        "Cannot enable API dependency when multiple selection is enabled. Please disable multiple selection first.",
                      );
                      return;
                    }
                  }
                }}
              >
                {t("Enable")}
              </Checkbox>
            </AntdForm.Item>
          </Col>
          {getNestedValue(
            formik.values,
            `${basePath}.validation.apiDependency.enabled`,
          ) && (
            <Col span={6}>
              <AntdForm.Item label={t("Depends On Field")}>
                <Select
                  value={
                    getNestedValue(
                      formik.values,
                      `${basePath}.validation.apiDependency.dependsOn`,
                    ) || undefined
                  }
                  onChange={(value) =>
                    formik.setFieldValue(
                      `${basePath}.validation.apiDependency.dependsOn`,
                      value,
                    )
                  }
                  placeholder={t("Select field")}
                  options={availableDependencyFields}
                  style={{ width: "100%" }}
                />
              </AntdForm.Item>
            </Col>
          )}
        </>
      }
      <Col span={12}>
        <AntdForm.Item
          label={t("Field Dependencies")}
          tooltip={t(
            "Select Section → Field → Options from multiple fields. Field will be visible when ALL field conditions are met (AND logic).",
          )}
        >
          <Cascader
            style={{ width: "100%" }}
            value={(() => {
              // Get cascader selection or build it from individual fields for backward compatibility
              const cascaderSelection = getNestedValue(
                formik.values,
                `${basePath}.dependency.cascader_selection`,
              );

              if (cascaderSelection && cascaderSelection.length > 0) {
                return cascaderSelection;
              }

              // Build from individual fields if cascader selection is empty
              const fieldSection = getNestedValue(
                formik.values,
                `${basePath}.dependency.field_section`,
              );
              const fieldName = getNestedValue(
                formik.values,
                `${basePath}.dependency.field_name`,
              );
              const optionsSelected =
                getNestedValue(
                  formik.values,
                  `${basePath}.dependency.options_selected`,
                ) || [];

              // Check for multiple field dependencies first
              const multipleFieldDeps =
                getNestedValue(
                  formik.values,
                  `${basePath}.dependency.multiple_field_dependencies`,
                ) || [];

              if (multipleFieldDeps.length > 0) {
                // Convert multiple field dependencies to cascader format
                const cascaderPaths = [];
                multipleFieldDeps.forEach((dep) => {
                  dep.options_selected.forEach((option) => {
                    cascaderPaths.push([
                      dep.field_section,
                      dep.field_name,
                      option,
                    ]);
                  });
                });
                return cascaderPaths;
              } else if (
                fieldSection &&
                fieldName &&
                optionsSelected.length > 0
              ) {
                // Convert single field dependency to cascader format
                return optionsSelected.map((option) => [
                  fieldSection,
                  fieldName,
                  option,
                ]);
              }

              return [];
            })()}
            onChange={(value) => {
              // Update the cascader selection
              formik.setFieldValue(
                `${basePath}.dependency.cascader_selection`,
                value,
              );

              // Parse and update dependency fields for multiple field support
              if (value && value.length > 0) {
                // Group by section and field, collect all options
                const pathsByField = {};
                value.forEach((path) => {
                  if (path.length >= 3) {
                    const [section, field, option] = path;
                    const key = `${section}|${field}`;
                    if (!pathsByField[key]) {
                      pathsByField[key] = {
                        section,
                        field,
                        options: [],
                      };
                    }
                    pathsByField[key].options.push(option);
                  }
                });

                // Store multiple field dependencies
                const multipleFieldDependencies = Object.keys(pathsByField).map(
                  (key) => {
                    const fieldData = pathsByField[key];
                    return {
                      field_section: fieldData.section,
                      field_name: fieldData.field,
                      options_selected: fieldData.options,
                    };
                  },
                );

                // Store the multiple dependencies
                formik.setFieldValue(
                  `${basePath}.dependency.multiple_field_dependencies`,
                  multipleFieldDependencies,
                );

                // For backward compatibility, store the first field in individual fields
                if (multipleFieldDependencies.length > 0) {
                  const firstDep = multipleFieldDependencies[0];
                  formik.setFieldValue(
                    `${basePath}.dependency.field_section`,
                    firstDep.field_section,
                  );
                  formik.setFieldValue(
                    `${basePath}.dependency.field_name`,
                    firstDep.field_name,
                  );
                  formik.setFieldValue(
                    `${basePath}.dependency.options_selected`,
                    firstDep.options_selected,
                  );
                }
              } else {
                // Clear all dependency fields
                formik.setFieldValue(
                  `${basePath}.dependency.field_section`,
                  "",
                );
                formik.setFieldValue(`${basePath}.dependency.field_name`, "");
                formik.setFieldValue(
                  `${basePath}.dependency.options_selected`,
                  [],
                );
                formik.setFieldValue(
                  `${basePath}.dependency.multiple_field_dependencies`,
                  [],
                );
              }
            }}
            options={(() => {
              // Build cascader options: Section → Field → Options
              const options = [];

              // Extract current field info from basePath (e.g., "sections.0.fields.3")
              const pathParts = basePath.split(".");
              const currentSectionIndex = parseInt(pathParts[1]);
              const currentFieldIndex = parseInt(pathParts[3]);
              const currentFieldName =
                formik.values.sections?.[currentSectionIndex]?.fields?.[
                  currentFieldIndex
                ]?.name;

              formik.values.sections?.forEach((section, idx) => {
                // Get fields with static options or dynamic endpoints
                const fieldsWithOptions =
                  section.fields?.filter((field) => {
                    // Exclude the current field itself (can't depend on itself)
                    if (field.name === currentFieldName) {
                      return false;
                    }

                    const hasStaticOptions =
                      field.options && field.options.length > 0;
                    const hasDynamicEndpoint = field.dynamic && field.end_point;
                    return hasStaticOptions || hasDynamicEndpoint;
                  }) || [];

                if (fieldsWithOptions.length > 0) {
                  options.push({
                    label: `📁 ${section.section_name || `Section ${idx + 1}`}`,
                    value: section.section_name || `Section ${idx + 1}`,
                    children: fieldsWithOptions.map((field) => {
                      // Determine options source: static or dynamic
                      let fieldOptions = field.options || [];
                      if (field.dynamic && field.end_point) {
                        const dynamicOptions =
                          dynamicOptionsMap[field.end_point];
                        if (dynamicOptions && dynamicOptions.length > 0) {
                          fieldOptions = dynamicOptions;
                        }
                      }

                      return {
                        label: `📋 ${field.label || field.name}`,
                        value: field.name,
                        children:
                          fieldOptions
                            ?.filter(
                              (option) =>
                                option !== null &&
                                option !== undefined &&
                                option !== "",
                            )
                            ?.map((option) => ({
                              label: `✓ ${typeof option === "object" ? option.label || option.name : option}`,
                              value:
                                typeof option === "object"
                                  ? option.value || option.id
                                  : option,
                            })) || [],
                      };
                    }),
                  });
                }
              });
              return options;
            })()}
            multiple
            maxTagCount="responsive"
            placeholder={t("Select: Section → Field → Option")}
            allowClear
            showSearch={{
              filter: (inputValue, path) =>
                path.some((option) =>
                  option.label.toLowerCase().includes(inputValue.toLowerCase()),
                ),
            }}
            displayRender={(labels) => {
              if (labels.length === 3) {
                const cleanLabels = labels.map((l) =>
                  l.replace(/^(📁|📋|✓)\s*/u, ""),
                );
                return `${cleanLabels[2]} (${cleanLabels[1]})`;
              }
              return labels.join(" → ");
            }}
            dropdownRender={(menus) => (
              <div>
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400">
                  {t("Select: Section → Field → Option")}
                </div>
                {menus}
              </div>
            )}
          />
        </AntdForm.Item>
      </Col>
    </Row>
  );
}

function FieldEditor({
  field,
  fieldIndex,
  sectionIndex,
  onRemove,
  formik,
  fieldTypes = [],
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  dynamicOptionsMap = {},
  fetchDynamicOptions,
  hideNumber = false,
  displayNumber = null,
}) {
  const basePath = `sections.${sectionIndex}.fields.${fieldIndex}`;
  const fieldType =
    formik.values.sections[sectionIndex]?.fields[fieldIndex]?.type;
  const isDynamic =
    formik.values.sections[sectionIndex]?.fields[fieldIndex]?.dynamic;

  // Ensure fieldTypes is always an array
  const safeFieldTypes = Array.isArray(fieldTypes) ? fieldTypes : [];

  // Fetch dynamic options when component mounts if this field is already configured as dynamic
  const endPoint =
    formik.values.sections[sectionIndex]?.fields[fieldIndex]?.end_point;

  useEffect(() => {
    if (isDynamic && endPoint && fetchDynamicOptions) {
      // Only fetch if options haven't been loaded yet
      if (!dynamicOptionsMap[endPoint]) {
        fetchDynamicOptions(endPoint);
      }
    }
  }, [isDynamic, endPoint]);

  const handleFieldTypeChange = (val, option) => {
    const selectedFieldType = safeFieldTypes.find((type) => type.id === val);

    formik.setFieldValue(`${basePath}.type_id`, val);
    formik.setFieldValue(`${basePath}.type`, option.type);
    formik.setFieldValue(`${basePath}.dynamic`, option.dynamic);
    formik.setFieldValue(`${basePath}.end_point`, option.end_point);

    if (selectedFieldType && selectedFieldType.validation_rules) {
      formik.setFieldValue(
        `${basePath}.validation`,
        selectedFieldType.validation_rules,
      );
    }

    // Set default width based on field type
    const fullWidthTypes = [
      "table",
      "textarea",
      "checkbox",
      "radio",
      "file",
      "image",
      "signature",
      "richtext",
      "date_range",
      "time_range",
    ];
    if (fullWidthTypes.includes(option.type)) {
      formik.setFieldValue(`${basePath}.width`, "100");
    }

    // Clear options whenever type changes
    formik.setFieldValue(`${basePath}.options`, []);

    // Clear table fields if not table type
    if (option.type !== "table") {
      formik.setFieldValue(`${basePath}.fields`, []);
      formik.setFieldValue(`${basePath}.value`, null);
    }

    // Fetch dynamic options if this is a dynamic field with an endpoint
    if (option.dynamic && option.end_point && fetchDynamicOptions) {
      fetchDynamicOptions(option.end_point);
    }
  };
  const { t } = useTranslation();
  const addOption = () => {
    const options =
      formik.values.sections[sectionIndex]?.fields[fieldIndex]?.options || [];
    formik.setFieldValue(`${basePath}.options`, [...options, ""]);
  };

  const removeOption = (optionIndex) => {
    const options =
      formik.values.sections[sectionIndex]?.fields[fieldIndex]?.options || [];
    const newOptions = options.filter((_, index) => index !== optionIndex);
    formik.setFieldValue(`${basePath}.options`, newOptions);
  };

  // Get error messages for this field
  const fieldErrors =
    formik.errors.sections?.[sectionIndex]?.fields?.[fieldIndex];
  const fieldTouched =
    formik.touched.sections?.[sectionIndex]?.fields?.[fieldIndex];

  return (
    <Card
      size="small"
      type="inner"
      style={{
        marginBottom: 16,
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        background: "#ffffff",
        transition: "all 0.2s ease",
      }}
      className="hover:shadow-md transition-all duration-200"
      title={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            {/* Move Up/Down Buttons */}
            <div className="flex flex-col gap-0.5">
              <Tooltip title={t("Move Up")}>
                <Button
                  type="text"
                  size="small"
                  icon={<NxChevronUp size={12} />}
                  onClick={onMoveUp}
                  disabled={isFirst}
                  style={{
                    padding: "1px 4px",
                    height: 16,
                    opacity: isFirst ? 0.3 : 1,
                  }}
                />
              </Tooltip>
              <Tooltip title={t("Move Down")}>
                <Button
                  type="text"
                  size="small"
                  icon={<NxChevronDown size={12} />}
                  onClick={onMoveDown}
                  disabled={isLast}
                  style={{
                    padding: "1px 4px",
                    height: 16,
                    opacity: isLast ? 0.3 : 1,
                  }}
                />
              </Tooltip>
            </div>
            {!hideNumber && (
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-600 text-white text-xs font-semibold">
                {displayNumber !== null ? displayNumber : fieldIndex + 1}
              </div>
            )}
            <div>
              <Text strong className="text-text-skin-base">
                {formik.values.sections[sectionIndex]?.fields[fieldIndex]
                  ?.label || t("Field") + " " + (fieldIndex + 1)}
              </Text>
              {fieldType && (
                <Text className="text-xs text-gray-400 ml-2">
                  ({fieldType})
                </Text>
              )}
              {/* Show width badge */}
              <Text className="text-xs text-blue-500 ml-2">
                [
                {formik.values.sections[sectionIndex]?.fields[fieldIndex]
                  ?.width || "33"}
                %]
              </Text>
            </div>
          </div>
          <Popconfirm
            title={t("Are you sure to delete this field?")}
            onConfirm={onRemove}
            okText={t("Yes")}
            cancelText={t("No")}
            okButtonProps={{ danger: true }}
          >
            <Button
              type="text"
              danger
              icon={<NxTrash />}
              size="small"
              className="hover:bg-red-50 dark:hover:bg-red-900/20"
              style={{ borderRadius: 6 }}
            />
          </Popconfirm>
        </div>
      }
      styles={{
        header: {
          padding: "12px 16px",
          background: "#fafbfc",
          borderBottom: "1px solid #f0f0f0",
        },
        body: {
          padding: 16,
        },
      }}
    >
      <Row gutter={[16, 16]} align="top">
        <Col span={8}>
          <AntdForm.Item
            label={
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                {t("Label")} <span className="text-red-500">*</span>
              </span>
            }
            validateStatus={
              fieldErrors?.label && fieldTouched?.label ? "error" : ""
            }
            help={
              fieldErrors?.label && fieldTouched?.label ? fieldErrors.label : ""
            }
            style={{ marginBottom: 0 }}
          >
            <SpellCheckInput
              name={`${basePath}.label`}
              value={
                formik.values.sections[sectionIndex]?.fields[fieldIndex]
                  ?.label || ""
              }
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              placeholder={t("Enter field label")}
              status={fieldErrors?.label && fieldTouched?.label ? "error" : ""}
              style={{ borderRadius: 6 }}
            />
          </AntdForm.Item>
        </Col>
        <Col span={7}>
          <AntdForm.Item
            label={
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                {t("Type")} <span className="text-red-500">*</span>
              </span>
            }
            validateStatus={
              fieldErrors?.type_id && fieldTouched?.type_id ? "error" : ""
            }
            help={
              fieldErrors?.type_id && fieldTouched?.type_id
                ? fieldErrors.type_id
                : ""
            }
            style={{ marginBottom: 0 }}
          >
            <Select
              value={
                formik.values.sections[sectionIndex]?.fields[fieldIndex]
                  ?.type_id
              }
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? "")
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              onChange={handleFieldTypeChange}
              onBlur={() => formik.setFieldTouched(`${basePath}.type_id`, true)}
              options={safeFieldTypes.map((type) => ({
                label: type.label,
                value: type.id,
                ...type,
              }))}
              status={
                fieldErrors?.type_id && fieldTouched?.type_id ? "error" : ""
              }
              placeholder={t("Select field type")}
              style={{ borderRadius: 6 }}
            />
          </AntdForm.Item>
        </Col>
        <Col span={5}>
          <AntdForm.Item
            label={
              <Space size={4}>
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                  {t("Width")}
                </span>
                <Tooltip title={t("Set the field width in the form layout")}>
                  <NxInfo style={{ fontSize: 12, color: "#999" }} />
                </Tooltip>
              </Space>
            }
            style={{ marginBottom: 0 }}
          >
            <Select
              value={
                formik.values.sections[sectionIndex]?.fields[fieldIndex]
                  ?.width || "33"
              }
              onChange={(val) => formik.setFieldValue(`${basePath}.width`, val)}
              options={FIELD_WIDTH_OPTIONS.map((opt) => ({
                label: opt.label,
                value: opt.value,
              }))}
              style={{ borderRadius: 6, width: "100%" }}
            />
          </AntdForm.Item>
        </Col>
        <Col span={4}>
          <AntdForm.Item
            label={
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                {t("Required")}
              </span>
            }
            style={{ marginBottom: 0 }}
          >
            <Switch
              checked={
                !!formik.values.sections[sectionIndex]?.fields[fieldIndex]
                  ?.required
              }
              onChange={(checked) =>
                formik.setFieldValue(`${basePath}.required`, checked)
              }
              checkedChildren="Yes"
              unCheckedChildren="No"
            />
          </AntdForm.Item>
        </Col>
      </Row>

      {/* Auto Generate - only for text/number type fields */}
      {fieldType && ["text", "number", "date"].includes(fieldType) && (
        <Row gutter={[16, 16]} style={{ marginTop: 12 }}>
          <Col span={4}>
            <AntdForm.Item
              label={
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                  {t("Auto Generate")}
                </span>
              }
              style={{ marginBottom: 0 }}
            >
              <Switch
                checked={
                  !!formik.values.sections[sectionIndex]?.fields[fieldIndex]
                    ?.auto_generate
                }
                onChange={(checked) => {
                  formik.setFieldValue(`${basePath}.auto_generate`, checked);
                  if (!checked) {
                    formik.setFieldValue(
                      `${basePath}.auto_generate_endpoint`,
                      "",
                    );
                  }
                }}
                checkedChildren="Yes"
                unCheckedChildren="No"
              />
            </AntdForm.Item>
          </Col>
          {!!formik.values.sections[sectionIndex]?.fields[fieldIndex]
            ?.auto_generate &&
            (() => {
              const endpointVal =
                formik.values.sections[sectionIndex]?.fields[fieldIndex]
                  ?.auto_generate_endpoint || "";
              const placeholders = endpointVal.match(/\{id\d+\}/g) || [];
              const mappings =
                formik.values.sections[sectionIndex]?.fields[fieldIndex]
                  ?.auto_generate_mappings || {};
              const otherFields = (formik.values.sections || [])
                .flatMap((section) => section.fields || [])
                .filter(
                  (f) =>
                    f.name !==
                      formik.values.sections[sectionIndex]?.fields[fieldIndex]
                        ?.name && f.label,
                )
                .map((f) => ({ label: f.label, value: f.name }));

              return (
                <>
                  <Col span={placeholders.length > 0 ? 12 : 20}>
                    <AntdForm.Item
                      label={
                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                          {t("API Endpoint")}
                        </span>
                      }
                      style={{ marginBottom: 0 }}
                    >
                      <Input
                        name={`${basePath}.auto_generate_endpoint`}
                        value={endpointVal}
                        onChange={formik.handleChange}
                        placeholder={t(
                          "e.g. /api/dms/documents/generate_number/{id1}/{id2}/",
                        )}
                        style={{ borderRadius: 6 }}
                      />
                    </AntdForm.Item>
                  </Col>
                  {placeholders.map((ph) => (
                    <Col span={4} key={ph}>
                      <AntdForm.Item
                        label={
                          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                            {ph}
                          </span>
                        }
                        style={{ marginBottom: 0 }}
                      >
                        <Select
                          value={mappings[ph] || undefined}
                          onChange={(val) =>
                            formik.setFieldValue(
                              `${basePath}.auto_generate_mappings.${ph}`,
                              val,
                            )
                          }
                          placeholder={t("Select field")}
                          allowClear
                          style={{ borderRadius: 6, width: "100%" }}
                          options={otherFields}
                        />
                      </AntdForm.Item>
                    </Col>
                  ))}
                </>
              );
            })()}
        </Row>
      )}

      {/* Verify Endpoint - only for password type fields */}
      {fieldType && fieldType === "password" && (
        <Row gutter={[16, 16]} style={{ marginTop: 12 }}>
          <Col span={4}>
            <AntdForm.Item
              label={
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                  {t("Verify Password")}
                </span>
              }
              style={{ marginBottom: 0 }}
            >
              <Switch
                checked={
                  !!formik.values.sections[sectionIndex]?.fields[fieldIndex]
                    ?.verify_password
                }
                onChange={(checked) => {
                  formik.setFieldValue(
                    `${basePath}.verify_endpoint`,
                    checked ? "" : "",
                  );
                  formik.setFieldValue(`${basePath}.verify_password`, checked);
                }}
                checkedChildren="Yes"
                unCheckedChildren="No"
              />
            </AntdForm.Item>
          </Col>
          {!!formik.values.sections[sectionIndex]?.fields[fieldIndex]
            ?.verify_password && (
            <Col span={20}>
              <AntdForm.Item
                label={
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                    {t("Verify API Endpoint")}
                  </span>
                }
                style={{ marginBottom: 0 }}
              >
                <Input
                  name={`${basePath}.verify_endpoint`}
                  value={
                    formik.values.sections[sectionIndex]?.fields[fieldIndex]
                      ?.verify_endpoint || ""
                  }
                  onChange={formik.handleChange}
                  placeholder={t("e.g. /api/verify_auth_password/")}
                  style={{ borderRadius: 6 }}
                />
              </AntdForm.Item>
            </Col>
          )}
        </Row>
      )}

      {fieldType && (
        <>
          <Divider style={{ margin: "16px 0 12px 0" }} />

          <Collapse
            ghost
            style={{ marginBottom: 8 }}
            expandIconPosition="end"
            className="bg-gray-50 dark:bg-gray-700/50 rounded-lg"
          >
            <Panel
              header={
                <div className="flex items-center gap-2">
                  <NxSettings className="text-blue-600" />
                  <span className="text-text-skin-secondary font-medium">
                    {t("Validation Rules & Dependencies")}
                  </span>
                </div>
              }
              key="validation"
              style={{ borderRadius: 8 }}
            >
              <DynamicValidationRules
                basePath={basePath}
                fieldType={fieldType}
                formik={formik}
                fieldTypes={safeFieldTypes}
                dynamicOptionsMap={dynamicOptionsMap}
                sectionIndex={sectionIndex}
                fieldIndex={fieldIndex}
              />
            </Panel>
          </Collapse>
        </>
      )}

      {!isDynamic &&
        (fieldType === "select" ||
          fieldType === "radio" ||
          fieldType === "checkbox") && (
          <Collapse
            ghost
            style={{ marginBottom: 8 }}
            expandIconPosition="end"
            className="bg-blue-50 dark:bg-blue-900/30 rounded-lg"
          >
            <Panel
              header={
                <div className="flex items-center gap-2">
                  <NxMenu className="text-blue-600" />
                  <span className="text-text-skin-secondary font-medium">
                    {t("Options")} (
                    {formik.values.sections[sectionIndex]?.fields[fieldIndex]
                      ?.options?.length || 0}
                    )
                  </span>
                </div>
              }
              key="options"
              style={{ borderRadius: 8 }}
            >
              <Space direction="vertical" style={{ width: "100%" }}>
                {(
                  formik.values.sections[sectionIndex]?.fields[fieldIndex]
                    ?.options || []
                ).map((opt, optIndex) => (
                  <Space key={optIndex} align="start">
                    <Input
                      name={`${basePath}.options.${optIndex}`}
                      value={opt}
                      onChange={formik.handleChange}
                      placeholder="Option value"
                      style={{ width: 200, borderRadius: 6 }}
                    />
                    <Popconfirm
                      title="Are you sure to delete?"
                      onConfirm={() => removeOption(optIndex)}
                      okText="Yes"
                      cancelText="No"
                      okButtonProps={{ danger: true }}
                    >
                      <Button
                        type="text"
                        danger
                        icon={<NxTrash />}
                        style={{ borderRadius: 6 }}
                      />
                    </Popconfirm>
                  </Space>
                ))}
                <Button
                  type="dashed"
                  icon={<NxPlus />}
                  onClick={addOption}
                  style={{
                    width: 200,
                    borderRadius: 6,
                  }}
                >
                  {t("Add Option")}
                </Button>
              </Space>
            </Panel>
          </Collapse>
        )}

      {fieldType === "table" && (
        <>
          <Divider orientation="left" style={{ fontSize: 13 }}>
            <span className="flex items-center gap-2 text-blue-600">
              <NxFormInput />
              {t("Table Columns")}
            </span>
          </Divider>
          <DynamicTableFieldEditor
            sectionIndex={sectionIndex}
            fieldIndex={fieldIndex}
            formik={formik}
            fieldTypes={fieldTypes}
            dynamicOptionsMap={dynamicOptionsMap}
          />
        </>
      )}
    </Card>
  );
}

function DynamicTableFieldEditor({
  sectionIndex,
  fieldIndex,
  formik,
  fieldTypes = [],
  dynamicOptionsMap = {},
}) {
  const fieldsPath = `sections.${sectionIndex}.fields.${fieldIndex}.fields`;
  const lockedCellsPath = `sections.${sectionIndex}.fields.${fieldIndex}.lockedCells`;
  const valuePath = `sections.${sectionIndex}.fields.${fieldIndex}.value`;

  const fields =
    formik.values.sections[sectionIndex]?.fields[fieldIndex]?.fields || [];
  const currentValue =
    formik.values.sections[sectionIndex]?.fields[fieldIndex]?.value || [];
  const lockedCells =
    formik.values.sections[sectionIndex]?.fields[fieldIndex]?.lockedCells || {};
  const { t } = useTranslation();

  // Ensure fieldTypes is always an array
  const safeFieldTypes = Array.isArray(fieldTypes) ? fieldTypes : [];

  // Initialize locked cells structure if it doesn't exist
  useEffect(() => {
    if (
      !formik.values.sections[sectionIndex]?.fields[fieldIndex]?.lockedCells
    ) {
      formik.setFieldValue(lockedCellsPath, {});
    }
    if (!formik.values.sections[sectionIndex]?.fields[fieldIndex]?.value) {
      formik.setFieldValue(valuePath, []);
    }
  }, []);

  const addTableField = () => {
    const newField = {
      label: "",
      name: generateUniqueName("col"),
      type: "",
      type_id: null,
      validation: {},
      required: false,
      options: [],
      fields: [],
      dependency: {
        field_section: "",
        field_name: "",
        options_selected: [],
        cascader_selection: [],
        multiple_field_dependencies: [],
      },
    };
    formik.setFieldValue(fieldsPath, [...fields, newField]);
  };

  const removeTableField = (i) => {
    const newFields = fields.filter((_, index) => index !== i);
    formik.setFieldValue(fieldsPath, newFields);

    const fieldName = fields[i]?.name;
    if (fieldName) {
      // Remove from locked cells
      const newLockedCells = { ...lockedCells };
      Object.keys(newLockedCells).forEach((key) => {
        if (
          newLockedCells[key] &&
          newLockedCells[key][fieldName] !== undefined
        ) {
          delete newLockedCells[key][fieldName];
        }
      });
      formik.setFieldValue(lockedCellsPath, newLockedCells);

      // Remove from form field value (this is what gets submitted)
      const newValue = currentValue.map((row) => {
        const newRow = { ...row };
        delete newRow[fieldName];
        return newRow;
      });
      formik.setFieldValue(valuePath, newValue);
    }
  };

  const addRow = () => {
    const newRow = fields.reduce((acc, field) => {
      if (field.name) {
        acc[field.name] = getInitialValue(field);
      }
      return acc;
    }, {});

    // Directly update the form field value (this gets submitted)
    formik.setFieldValue(valuePath, [...currentValue, newRow]);
  };

  const removeRow = (rowIndex) => {
    // Remove from locked cells and adjust indices
    const newLockedCells = { ...lockedCells };
    delete newLockedCells[rowIndex];

    // Adjust indices for remaining rows
    const adjustedLockedCells = {};
    Object.keys(newLockedCells).forEach((key) => {
      const keyIndex = parseInt(key);
      if (keyIndex > rowIndex) {
        adjustedLockedCells[keyIndex - 1] = newLockedCells[key];
      } else if (keyIndex < rowIndex) {
        adjustedLockedCells[key] = newLockedCells[key];
      }
    });
    formik.setFieldValue(lockedCellsPath, adjustedLockedCells);

    // Remove from form field value (this gets submitted)
    const newValue = currentValue.filter((_, index) => index !== rowIndex);
    formik.setFieldValue(valuePath, newValue);
  };

  const updateCellValue = (rowIndex, fieldName, value) => {
    // Check if cell is locked - if locked, don't allow updates
    if (isCellLocked(rowIndex, fieldName)) {
      return;
    }

    // Directly update the form field value (this gets submitted)
    const newValue = currentValue.map((row, index) => {
      if (index === rowIndex) {
        return { ...row, [fieldName]: value };
      }
      return { ...row };
    });
    formik.setFieldValue(valuePath, newValue);
  };

  const toggleCellLock = (rowIndex, fieldName) => {
    const newLockedCells = { ...lockedCells };

    if (!newLockedCells[rowIndex]) {
      newLockedCells[rowIndex] = {};
    }

    if (newLockedCells[rowIndex][fieldName]) {
      // Unlocking cell
      delete newLockedCells[rowIndex][fieldName];
      if (Object.keys(newLockedCells[rowIndex]).length === 0) {
        delete newLockedCells[rowIndex];
      }
    } else {
      // Locking cell - store current value in lockedCells for reference
      const currentCellValue =
        currentValue[rowIndex]?.[fieldName] ||
        getInitialValue(fields.find((f) => f.name === fieldName));
      newLockedCells[rowIndex][fieldName] = true; // Just mark as locked, value is in form.value

      // Ensure the value is set in the form field value
      const newValue = [...currentValue];
      if (!newValue[rowIndex]) {
        newValue[rowIndex] = {};
      }
      newValue[rowIndex][fieldName] = currentCellValue;
      formik.setFieldValue(valuePath, newValue);
    }

    formik.setFieldValue(lockedCellsPath, newLockedCells);
  };

  const isCellLocked = (rowIndex, fieldName) => {
    return lockedCells[rowIndex] && lockedCells[rowIndex][fieldName];
  };

  const getInitialValue = (field) => {
    switch (field.type) {
      case "text":
      case "email":
      case "password":
        return "";
      case "number":
        return 0;
      case "textarea":
        return "";
      case "switch":
        return false;
      case "checkbox":
        return [];
      case "radio":
        return "";
      case "select":
        return field.validation?.isMultiple ? [] : null;
      case "date":
      case "time":
        return "";
      case "date_range":
      case "time_range":
        return [];
      case "range":
        return field.validation?.min || 0;
      case "color":
        return "#1677ff";
      case "file":
      case "image":
        return field.validation?.isMultiple ? [] : null;
      case "signature":
        return "";
      case "richtext":
        return "";
      case "multi_text":
        return [];
      default:
        return "";
    }
  };

  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      {/* Column Definitions - ALL YOUR EXISTING CODE REMAINS THE SAME */}
      <Card title="Table Columns" size="small" style={{ marginBottom: 16 }}>
        {fields.map((field, i) => {
          const fieldType =
            formik.values.sections[sectionIndex]?.fields[fieldIndex]?.fields[i]
              ?.type;
          const isDynamic =
            formik.values.sections[sectionIndex]?.fields[fieldIndex]?.fields[i]
              ?.dynamic;
          const tableFieldErrors =
            formik.errors.sections?.[sectionIndex]?.fields?.[fieldIndex]
              ?.fields?.[i];
          const tableFieldTouched =
            formik.touched.sections?.[sectionIndex]?.fields?.[fieldIndex]
              ?.fields?.[i];

          return (
            <Card
              key={`table-field-${i}`}
              size="small"
              type="inner"
              style={{ marginBottom: 8, background: "#fafbfc" }}
              title={
                <Space>
                  <span>
                    {t("Table Field")} {i + 1}
                  </span>
                  <Popconfirm
                    title={t("Are you sure to delete?")}
                    onConfirm={() => removeTableField(i)}
                    okText={t("Yes")}
                    cancelText={t("No")}
                  >
                    <Button type="text" danger icon={<NxTrash />} />
                  </Popconfirm>
                </Space>
              }
              styles={{ padding: 12 }}
            >
              {/* ALL YOUR EXISTING COLUMN CONFIGURATION CODE */}
              <Row gutter={16} align="middle">
                <Col span={8}>
                  <AntdForm.Item
                    label="Label"
                    required
                    validateStatus={
                      tableFieldErrors?.label && tableFieldTouched?.label
                        ? "error"
                        : ""
                    }
                    help={
                      tableFieldErrors?.label && tableFieldTouched?.label
                        ? tableFieldErrors.label
                        : ""
                    }
                  >
                    <Input
                      name={`${fieldsPath}.${i}.label`}
                      value={
                        formik.values.sections[sectionIndex]?.fields[fieldIndex]
                          ?.fields[i]?.label || ""
                      }
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      placeholder={t("Field Label")}
                      status={
                        tableFieldErrors?.label && tableFieldTouched?.label
                          ? "error"
                          : ""
                      }
                    />
                  </AntdForm.Item>
                </Col>
                <Col span={8}>
                  <AntdForm.Item
                    label="Type"
                    required
                    validateStatus={
                      tableFieldErrors?.type_id && tableFieldTouched?.type_id
                        ? "error"
                        : ""
                    }
                    help={
                      tableFieldErrors?.type_id && tableFieldTouched?.type_id
                        ? tableFieldErrors.type_id
                        : ""
                    }
                  >
                    <Select
                      value={
                        formik.values.sections[sectionIndex]?.fields[fieldIndex]
                          ?.fields[i]?.type_id || null
                      }
                      onChange={(val, option) => {
                        formik.setFieldValue(`${fieldsPath}.${i}.type_id`, val);
                        formik.setFieldValue(
                          `${fieldsPath}.${i}.type`,
                          option.type,
                        );
                        formik.setFieldValue(
                          `${fieldsPath}.${i}.dynamic`,
                          option.dynamic,
                        );
                        formik.setFieldValue(
                          `${fieldsPath}.${i}.end_point`,
                          option.end_point,
                        );

                        const selectedFieldType = safeFieldTypes.find(
                          (ft) => ft.id === val,
                        );
                        if (
                          selectedFieldType &&
                          selectedFieldType.validation_rules
                        ) {
                          formik.setFieldValue(
                            `${fieldsPath}.${i}.validation`,
                            selectedFieldType.validation_rules,
                          );
                        }

                        if (
                          option.type !== "select" &&
                          option.type !== "radio" &&
                          option.type !== "checkbox"
                        ) {
                          formik.setFieldValue(
                            `${fieldsPath}.${i}.options`,
                            [],
                          );
                        }
                        if (option.type !== "table") {
                          formik.setFieldValue(`${fieldsPath}.${i}.fields`, []);
                        }
                      }}
                      onBlur={() =>
                        formik.setFieldTouched(
                          `${fieldsPath}.${i}.type_id`,
                          true,
                        )
                      }
                      showSearch
                      optionFilterProp="children"
                      filterOption={(input, option) =>
                        (option?.label ?? "")
                          .toLowerCase()
                          .includes(input.toLowerCase())
                      }
                      options={safeFieldTypes.map((type) => ({
                        label: type.label,
                        value: type.id,
                        ...type,
                      }))}
                      status={
                        tableFieldErrors?.type_id && tableFieldTouched?.type_id
                          ? "error"
                          : ""
                      }
                    />
                  </AntdForm.Item>
                </Col>
                <Col span={4}>
                  <AntdForm.Item label={t("Required")}>
                    <Checkbox
                      checked={
                        !!formik.values.sections[sectionIndex]?.fields[
                          fieldIndex
                        ]?.fields[i]?.required
                      }
                      onChange={(e) =>
                        formik.setFieldValue(
                          `${fieldsPath}.${i}.required`,
                          e.target.checked,
                        )
                      }
                    >
                      {t("Required")}
                    </Checkbox>
                  </AntdForm.Item>
                </Col>
              </Row>

              {/* Auto Generate - only for text/number type table columns */}
              {fieldType && ["text", "number"].includes(fieldType) && (
                <Row gutter={[16, 16]} style={{ marginTop: 12 }}>
                  <Col span={4}>
                    <AntdForm.Item
                      label={
                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                          {t("Auto Generate")}
                        </span>
                      }
                      style={{ marginBottom: 0 }}
                    >
                      <Switch
                        checked={
                          !!formik.values.sections[sectionIndex]?.fields[
                            fieldIndex
                          ]?.fields[i]?.auto_generate
                        }
                        onChange={(checked) => {
                          formik.setFieldValue(
                            `${fieldsPath}.${i}.auto_generate`,
                            checked,
                          );
                          if (!checked) {
                            formik.setFieldValue(
                              `${fieldsPath}.${i}.auto_generate_endpoint`,
                              "",
                            );
                            formik.setFieldValue(
                              `${fieldsPath}.${i}.auto_generate_mappings`,
                              {},
                            );
                          }
                        }}
                        checkedChildren="Yes"
                        unCheckedChildren="No"
                      />
                    </AntdForm.Item>
                  </Col>
                  {!!formik.values.sections[sectionIndex]?.fields[fieldIndex]
                    ?.fields[i]?.auto_generate &&
                    (() => {
                      const endpointVal =
                        formik.values.sections[sectionIndex]?.fields[fieldIndex]
                          ?.fields[i]?.auto_generate_endpoint || "";
                      const placeholders =
                        endpointVal.match(/\{id\d+\}/g) || [];
                      const mappings =
                        formik.values.sections[sectionIndex]?.fields[fieldIndex]
                          ?.fields[i]?.auto_generate_mappings || {};
                      // For table columns, dependencies can be other columns in the same table OR section-level fields
                      const otherTableColumns = fields
                        .filter((f, idx) => idx !== i && f.label)
                        .map((f) => ({
                          label: `[Column] ${f.label}`,
                          value: f.name,
                        }));
                      const sectionFields = (
                        formik.values.sections[sectionIndex]?.fields || []
                      )
                        .filter(
                          (f) =>
                            f.name !==
                              formik.values.sections[sectionIndex]?.fields[
                                fieldIndex
                              ]?.name &&
                            f.label &&
                            f.type !== "table",
                        )
                        .map((f) => ({
                          label: `[Field] ${f.label}`,
                          value: f.name,
                        }));
                      const allDependencyOptions = [
                        ...otherTableColumns,
                        ...sectionFields,
                      ];

                      return (
                        <>
                          <Col span={placeholders.length > 0 ? 12 : 20}>
                            <AntdForm.Item
                              label={
                                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                                  {t("API Endpoint")}
                                </span>
                              }
                              style={{ marginBottom: 0 }}
                            >
                              <Input
                                name={`${fieldsPath}.${i}.auto_generate_endpoint`}
                                value={endpointVal}
                                onChange={formik.handleChange}
                                placeholder={t(
                                  "e.g. /api/dms/documents/generate_number/{id1}/{id2}/",
                                )}
                                style={{ borderRadius: 6 }}
                              />
                            </AntdForm.Item>
                          </Col>
                          {placeholders.map((ph) => (
                            <Col span={4} key={ph}>
                              <AntdForm.Item
                                label={
                                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                                    {ph}
                                  </span>
                                }
                                style={{ marginBottom: 0 }}
                              >
                                <Select
                                  value={mappings[ph] || undefined}
                                  onChange={(val) =>
                                    formik.setFieldValue(
                                      `${fieldsPath}.${i}.auto_generate_mappings.${ph}`,
                                      val,
                                    )
                                  }
                                  placeholder={t("Select field")}
                                  allowClear
                                  style={{ borderRadius: 6, width: "100%" }}
                                  options={allDependencyOptions}
                                />
                              </AntdForm.Item>
                            </Col>
                          ))}
                        </>
                      );
                    })()}
                </Row>
              )}

              <Collapse ghost style={{ marginBottom: 8 }}>
                <Panel header="Validation Rules" key="validation">
                  <DynamicValidationRules
                    basePath={`${fieldsPath}.${i}`}
                    fieldType={fieldType}
                    formik={formik}
                    fieldTypes={safeFieldTypes}
                    dynamicOptionsMap={dynamicOptionsMap}
                    isTableColumn={true}
                    tableColumns={fields}
                    currentColumnIndex={i}
                  />
                </Panel>
              </Collapse>

              {!isDynamic &&
                (fieldType === "select" ||
                  fieldType === "radio" ||
                  fieldType === "checkbox") && (
                  <Collapse ghost style={{ marginBottom: 8 }}>
                    <Panel header="Options" key="options">
                      <Space direction="vertical" style={{ width: "100%" }}>
                        {(
                          formik.values.sections[sectionIndex]?.fields[
                            fieldIndex
                          ]?.fields[i]?.options || []
                        ).map((opt, optIndex) => (
                          <Space key={optIndex} align="start">
                            <Input
                              name={`${fieldsPath}.${i}.options.${optIndex}`}
                              value={opt}
                              onChange={formik.handleChange}
                              placeholder="Option value"
                              style={{ width: 180 }}
                            />
                            <Popconfirm
                              title="Are you sure to delete?"
                              onConfirm={() => {
                                const options =
                                  formik.values.sections[sectionIndex]?.fields[
                                    fieldIndex
                                  ]?.fields[i]?.options || [];
                                const newOptions = options.filter(
                                  (_, index) => index !== optIndex,
                                );
                                formik.setFieldValue(
                                  `${fieldsPath}.${i}.options`,
                                  newOptions,
                                );
                              }}
                              okText="Yes"
                              cancelText="No"
                            >
                              <Button type="text" danger icon={<NxTrash />} />
                            </Popconfirm>
                          </Space>
                        ))}
                        <Button
                          type="dashed"
                          icon={<NxPlus />}
                          onClick={() => {
                            const options =
                              formik.values.sections[sectionIndex]?.fields[
                                fieldIndex
                              ]?.fields[i]?.options || [];
                            formik.setFieldValue(`${fieldsPath}.${i}.options`, [
                              ...options,
                              "",
                            ]);
                          }}
                          style={{ width: 180 }}
                        >
                          Add Option
                        </Button>
                      </Space>
                    </Panel>
                  </Collapse>
                )}
            </Card>
          );
        })}

        <Button type="dashed" icon={<NxPlus />} onClick={addTableField}>
          Add Table Field
        </Button>
      </Card>

      {/* Table Rows with Locked Cell functionality - Values stored directly in form.value */}
      {fields.length > 0 && (
        <Card
          title="Table Rows & Cell Locking"
          size="small"
          extra={
            <Tooltip title="Add rows and lock specific cells. Locked values are stored directly in form field value for submission.">
              <NxInfo style={{ color: "#1890ff" }} />
            </Tooltip>
          }
        >
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">
              Add table rows and lock specific cells. Locked cells cannot be
              modified by users and values are stored directly in the form
              field.
              <NxLock style={{ margin: "0 4px", color: "#ff7875" }} />
              indicates locked cells.
            </Text>
          </div>

          {currentValue.length > 0 && (
            <div
              style={{
                border: "1px solid #d9d9d9",
                borderRadius: "6px",
                overflow: "hidden",
                marginBottom: 16,
              }}
            >
              {/* Table Container with Horizontal Scroll */}
              <div
                style={{
                  overflowX: "auto",
                  width: "100%",
                }}
              >
                {/* Table Header */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${fields.length}, minmax(150px, 1fr)) 60px`,
                    backgroundColor: "#fafafa",
                    borderBottom: "1px solid #d9d9d9",
                    padding: "8px 0",
                    minWidth:
                      fields.length > 4
                        ? `${fields.length * 150 + 60}px`
                        : "100%",
                  }}
                >
                  {fields.map((field) => (
                    <div
                      key={field.name}
                      style={{
                        padding: "8px 12px",
                        fontWeight: "600",
                        borderRight: "1px solid #e8e8e8",
                        fontSize: "12px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {field.label || "Untitled"}
                    </div>
                  ))}
                  <div
                    style={{
                      padding: "8px 12px",
                      textAlign: "center",
                    }}
                  >
                    Action
                  </div>
                </div>

                {/* Table Rows with Lock functionality */}
                {currentValue.map((row, rowIndex) => (
                  <div
                    key={rowIndex}
                    style={{
                      display: "grid",
                      gridTemplateColumns: `repeat(${fields.length}, minmax(150px, 1fr)) 60px`,
                      borderBottom:
                        rowIndex < currentValue.length - 1
                          ? "1px solid #e8e8e8"
                          : "none",
                      minWidth:
                        fields.length > 4
                          ? `${fields.length * 150 + 60}px`
                          : "100%",
                    }}
                  >
                    {fields.map((field) => {
                      const isLocked = isCellLocked(rowIndex, field.name);
                      const cellValue =
                        row[field.name] !== undefined
                          ? row[field.name]
                          : getInitialValue(field);

                      return (
                        <div
                          key={`${rowIndex}-${field.name}`}
                          style={{
                            borderRight: "1px solid #e8e8e8",
                            minHeight: "40px",
                            display: "flex",
                            alignItems: "center",
                            position: "relative",
                            backgroundColor: isLocked
                              ? "#fff1f0"
                              : "transparent",
                            flexWrap: "wrap",
                            gap: "2px",
                          }}
                        >
                          {/* Lock/Unlock Button */}
                          <Button
                            type="text"
                            size="small"
                            icon={isLocked ? <NxLock /> : <NxUnlock />}
                            onClick={() => toggleCellLock(rowIndex, field.name)}
                            style={{
                              position: "absolute",
                              top: "2px",
                              right: "2px",
                              zIndex: 1,
                              width: "16px",
                              height: "16px",
                              padding: 0,
                              color: isLocked ? "#ff7875" : "#d9d9d9",
                            }}
                          />

                          {/* Cell Content */}
                          <div
                            style={{
                              width: "100%",
                              padding: "2px 4px",
                              paddingRight: "20px",
                            }}
                          >
                            {renderCellEditor(
                              field,
                              cellValue,
                              (value) =>
                                updateCellValue(rowIndex, field.name, value),
                              isLocked,
                            )}
                          </div>
                        </div>
                      );
                    })}

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "2px",
                      }}
                    >
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<NxTrash />}
                        onClick={() => removeRow(rowIndex)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button
            type="dashed"
            icon={<NxPlus />}
            onClick={addRow}
            disabled={fields.length === 0 || fields.some((f) => !f.name)}
            block
          >
            Add Table Row
          </Button>

          {fields.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "20px",
                color: "#999",
                fontStyle: "italic",
              }}
            >
              Add columns first to create rows
            </div>
          )}
        </Card>
      )}
    </Space>
  );
}

// Cell editor that stores values directly in form.value
const renderCellEditor = (field, value, onChange, isLocked = false) => {
  const cellStyle = {
    width: "100%",
    border: "none",
    outline: "none",
    backgroundColor: "transparent",
    fontSize: "12px",
  };

  const commonProps = {
    disabled: isLocked,
    style: { ...cellStyle, opacity: isLocked ? 0.6 : 1 },
  };

  // File upload handler for table cells
  const handleFileUpload = async (file, isMultiple = false) => {
    if (isLocked) return false;

    try {
      // Create a mock file object for demonstration
      const fileObj = {
        file_id: Date.now().toString(),
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        file_url: URL.createObjectURL(file),
      };

      if (isMultiple) {
        const currentFiles = Array.isArray(value) ? value : [];
        onChange([...currentFiles, fileObj]);
      } else {
        onChange(fileObj);
      }

      Toast.success("File uploaded successfully!");
      return false;
    } catch (error) {
      Toast.error("Error uploading file");
      return false;
    }
  };

  // File preview component for table cells
  const FilePreview = ({
    file,
    onRemove,
    isImage = false,
    isLocked = false,
  }) => {
    const handlePreview = () => {
      if (file.file_url) {
        window.open(file.file_url, "_blank");
      }
    };

    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "4px",
          border: "1px solid #d9d9d9",
          borderRadius: "4px",
          marginBottom: "4px",
          fontSize: "10px",
          opacity: isLocked ? 0.6 : 1,
        }}
      >
        {isImage && file.file_url && (
          <img
            src={file.file_url}
            alt={file.file_name}
            style={{
              width: "20px",
              height: "20px",
              objectFit: "cover",
              borderRadius: "2px",
              marginRight: "4px",
            }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: "bold",
              fontSize: "10px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {file.file_name}
          </div>
          <div style={{ fontSize: "9px", color: "#666" }}>
            {(file.file_size / 1024).toFixed(1)} KB
          </div>
        </div>
        <div style={{ display: "flex", gap: "2px" }}>
          <Button
            size="small"
            onClick={handlePreview}
            disabled={!file.file_url}
            style={{ fontSize: "9px", padding: "0 4px", height: "20px" }}
          >
            View
          </Button>
          <Button
            size="small"
            danger
            icon={<NxTrash />}
            onClick={onRemove}
            disabled={isLocked}
            style={{ fontSize: "9px", padding: "0 4px", height: "20px" }}
          />
        </div>
      </div>
    );
  };

  switch (field.type) {
    case "multi_text":
      return (
        <Select
          mode="tags"
          open={false}
          style={{ width: "100%", minWidth: "150px" }}
          placeholder={field.label || "Enter values"}
          value={Array.isArray(value) ? value : []}
          onChange={isLocked ? undefined : onChange}
          tokenSeparators={[","]}
          size="small"
          variant="borderless"
          disabled={isLocked}
          suffixIcon={null}
          {...commonProps}
        />
      );
    case "text":
      return (
        <Input
          value={value || ""}
          onChange={isLocked ? undefined : (e) => onChange(e.target.value)}
          placeholder={field.label}
          size="small"
          variant="borderless"
          {...commonProps}
        />
      );

    case "email":
      return (
        <Input
          type="email"
          value={value || ""}
          onChange={isLocked ? undefined : (e) => onChange(e.target.value)}
          placeholder={`Enter ${field.label?.toLowerCase() || "email"}`}
          size="small"
          variant="borderless"
          {...commonProps}
        />
      );

    case "password":
      return (
        <Input.Password
          value={value || ""}
          onChange={isLocked ? undefined : (e) => onChange(e.target.value)}
          placeholder={`Enter ${field.label?.toLowerCase() || "password"}`}
          size="small"
          variant="borderless"
          {...commonProps}
        />
      );

    case "number":
      return (
        <InputNumber
          style={{ width: "100%" }}
          value={value === "" ? undefined : value}
          onChange={
            isLocked ? undefined : (val) => onChange(val === null ? "" : val)
          }
          placeholder={field.label}
          size="small"
          variant="borderless"
          controls={false}
          {...commonProps}
        />
      );

    case "textarea":
      return (
        <TextArea
          value={value || ""}
          onChange={isLocked ? undefined : (e) => onChange(e.target.value)}
          placeholder={`Enter ${field.label?.toLowerCase() || "text"}`}
          rows={1}
          autoSize={{ minRows: 1, maxRows: 3 }}
          variant="borderless"
          {...commonProps}
        />
      );

    case "select":
      return (
        <Select
          value={
            typeof value === "object" && value !== null
              ? field.validation?.isMultiple
                ? Array.isArray(value)
                  ? value.map((v) => v.value)
                  : []
                : value?.value
              : value
          }
          onChange={
            isLocked
              ? undefined
              : (selectedValue) => {
                  if (field.validation?.isMultiple) {
                    const selectedObjects = Array.isArray(selectedValue)
                      ? selectedValue.map((val) => {
                          const opt = field.options?.find(
                            (o) =>
                              (typeof o === "object" ? o.value : o) === val,
                          );
                          return typeof opt === "object"
                            ? opt
                            : { label: val, value: val };
                        })
                      : [];
                    onChange(selectedObjects);
                  } else {
                    const selectedOption = field.options?.find(
                      (o) =>
                        (typeof o === "object" ? o.value : o) === selectedValue,
                    );
                    const objectValue =
                      typeof selectedOption === "object"
                        ? selectedOption
                        : { label: selectedValue, value: selectedValue };
                    onChange(objectValue);
                  }
                }
          }
          placeholder="Select..."
          size="small"
          variant="borderless"
          style={{ width: "100%" }}
          mode={field.validation?.isMultiple ? "multiple" : undefined}
          options={field.options?.map((opt) => ({
            label: typeof opt === "object" ? opt.label : opt,
            value: typeof opt === "object" ? opt.value : opt,
          }))}
          allowClear={!isLocked}
          {...commonProps}
        />
      );

    case "radio":
      return (
        <RadioGroup
          value={value}
          onChange={isLocked ? undefined : (e) => onChange(e.target.value)}
          size="small"
          disabled={isLocked}
        >
          {field.options?.map((opt) => (
            <Radio key={opt} value={opt} style={{ fontSize: "12px" }}>
              {opt}
            </Radio>
          ))}
        </RadioGroup>
      );

    case "checkbox":
      return (
        <Select
          value={
            Array.isArray(value)
              ? value.map((v) => (typeof v === "object" ? v.value : v))
              : []
          }
          onChange={
            isLocked
              ? undefined
              : (selectedValues) => {
                  const selectedObjects = selectedValues.map((val) => {
                    const opt = field.options?.find(
                      (o) => (typeof o === "object" ? o.value : o) === val,
                    );
                    return typeof opt === "object"
                      ? opt
                      : { label: val, value: val };
                  });
                  onChange(selectedObjects);
                }
          }
          placeholder="Select..."
          size="small"
          variant="borderless"
          style={{ width: "100%" }}
          mode="multiple"
          options={field.options?.map((opt) => ({
            label: typeof opt === "object" ? opt.label : opt,
            value: typeof opt === "object" ? opt.value : opt,
          }))}
          allowClear={!isLocked}
          {...commonProps}
        />
      );

    case "date":
      return (
        <DatePicker
          value={value ? dayjs(value) : null}
          onChange={
            isLocked
              ? undefined
              : (date, dateString) => onChange(dateString || "")
          }
          size="small"
          variant="borderless"
          style={{ width: "100%" }}
          placeholder="Select date"
          {...commonProps}
        />
      );

    case "date_range":
      return (
        <RangePicker
          value={
            value && Array.isArray(value) && value.length === 2
              ? [dayjs(value[0]), dayjs(value[1])]
              : null
          }
          onChange={
            isLocked ? undefined : (dates, dateStrings) => onChange(dateStrings)
          }
          size="small"
          variant="borderless"
          style={{ width: "100%" }}
          placeholder={["Start date", "End date"]}
          {...commonProps}
        />
      );

    case "time":
      return (
        <TimePicker
          value={value ? dayjs(value, "HH:mm:ss") : null}
          onChange={
            isLocked
              ? undefined
              : (time, timeString) => onChange(timeString || "")
          }
          size="small"
          variant="borderless"
          style={{ width: "100%" }}
          placeholder="Select time"
          {...commonProps}
        />
      );

    case "time_range":
      return (
        <TimePicker.RangePicker
          value={
            value && Array.isArray(value) && value.length === 2
              ? [dayjs(value[0], "HH:mm:ss"), dayjs(value[1], "HH:mm:ss")]
              : null
          }
          onChange={
            isLocked ? undefined : (times, timeStrings) => onChange(timeStrings)
          }
          size="small"
          variant="borderless"
          style={{ width: "100%" }}
          placeholder={["Start time", "End time"]}
          {...commonProps}
        />
      );

    case "switch":
      return (
        <Switch
          checked={value || false}
          onChange={isLocked ? undefined : onChange}
          size="small"
          disabled={isLocked}
        />
      );

    case "range":
      return (
        <div style={{ padding: "4px 0" }}>
          <Slider
            min={field.validation?.min || 0}
            max={field.validation?.max || 100}
            step={field.validation?.step || 1}
            value={value || 0}
            onChange={isLocked ? undefined : onChange}
            disabled={isLocked}
            style={{ margin: "0 8px" }}
          />
          <div style={{ textAlign: "center", fontSize: "10px", color: "#666" }}>
            {value || 0}
          </div>
        </div>
      );

    case "color":
      return (
        <ColorPicker
          value={value || "#1677ff"}
          onChange={
            isLocked ? undefined : (color) => onChange(color.toHexString())
          }
          size="small"
          showText
          disabled={isLocked}
        />
      );

    case "file":
    case "image": {
      const isMultiple = field.validation?.isMultiple;
      const currentFiles = isMultiple
        ? Array.isArray(value)
          ? value
          : []
        : value;

      return (
        <div style={{ minWidth: "150px" }}>
          <Upload
            beforeUpload={(file) => handleFileUpload(file, isMultiple)}
            showUploadList={false}
            accept={field.type === "image" ? "image/*" : undefined}
            disabled={isLocked}
          >
            <Button
              size="small"
              icon={<NxUpload />}
              style={{ fontSize: "10px" }}
              disabled={isLocked}
            >
              Upload
            </Button>
          </Upload>
          <div
            style={{ marginTop: "4px", maxHeight: "120px", overflowY: "auto" }}
          >
            {isMultiple
              ? Array.isArray(currentFiles) &&
                currentFiles.length > 0 && (
                  <div>
                    {currentFiles.map((file, index) => (
                      <FilePreview
                        key={index}
                        file={file}
                        isImage={field.type === "image"}
                        isLocked={isLocked}
                        onRemove={() => {
                          if (!isLocked) {
                            const newFiles = currentFiles.filter(
                              (_, i) => i !== index,
                            );
                            onChange(newFiles);
                          }
                        }}
                      />
                    ))}
                  </div>
                )
              : currentFiles && (
                  <FilePreview
                    file={currentFiles}
                    isImage={field.type === "image"}
                    isLocked={isLocked}
                    onRemove={() => {
                      if (!isLocked) {
                        onChange(null);
                      }
                    }}
                  />
                )}
          </div>
        </div>
      );
    }

    case "signature": {
      const signatureKey = `signature-${field.name}-${Date.now()}`;
      return (
        <div style={{ minWidth: "200px", minHeight: "100px" }}>
          <SignatureCanvas
            ref={(ref) => {
              if (ref && !isLocked) {
                window[signatureKey] = ref;
              }
            }}
            canvasProps={{
              style: {
                border: "1px dashed #ccc",
                borderRadius: "4px",
                height: "80px",
                width: "100%",
                pointerEvents: isLocked ? "none" : "auto",
              },
            }}
            onEnd={() => {
              if (window[signatureKey] && !isLocked) {
                const dataUrl = window[signatureKey].toDataURL();
                onChange(dataUrl);
              }
            }}
          />
          <Button
            size="small"
            onClick={() => {
              if (window[signatureKey] && !isLocked) {
                window[signatureKey].clear();
                onChange("");
              }
            }}
            disabled={isLocked}
            style={{ fontSize: "10px", marginTop: "2px" }}
          >
            Clear
          </Button>
        </div>
      );
    }

    case "richtext":
      return (
        <div style={{ minWidth: "300px", minHeight: "120px" }}>
          <ReactQuill
            value={value || ""}
            onChange={isLocked ? undefined : onChange}
            placeholder={field.label}
            readOnly={isLocked}
            style={{
              fontSize: "12px",
              opacity: isLocked ? 0.6 : 1,
            }}
            modules={{
              toolbar: isLocked
                ? false
                : [
                    ["bold", "italic", "underline"],
                    [{ list: "ordered" }, { list: "bullet" }],
                    ["link"],
                    ["clean"],
                  ],
            }}
            formats={["bold", "italic", "underline", "list", "link"]}
          />
        </div>
      );

    default:
      return (
        <Input
          value={value || ""}
          onChange={isLocked ? undefined : (e) => onChange(e.target.value)}
          placeholder={`Enter ${field.label?.toLowerCase() || "value"}`}
          size="small"
          variant="borderless"
          {...commonProps}
        />
      );
  }
};
