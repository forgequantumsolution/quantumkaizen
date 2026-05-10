import React, { useState } from "react";
import {
  Button,
  Modal,
  Input,
  Select,
  Checkbox,
  Space,
  List,
  Card,
  Typography,
  Row,
  Col,
  InputNumber,
  Collapse,
  Form as AntForm,
  NxPlus,
  NxEdit,
  NxTrash,
  Toast,
} from "@nexgensis/core";
import { VALIDATION_FIELD_CONFIGS } from "./validationRules";
import { useFieldTypes } from "../hooks/useFieldTypes";
import { useDataTypes } from "../hooks/useDataTypes";
import { add_field_type, update_field_type } from "../api/dynamic-form-api";
import { Formik } from "formik";
import { deleteCustomFieldType } from "../api/form_apis";
import { useTranslation } from "react-i18next";

const { Title, Text } = Typography;
const { Panel } = Collapse;
export default function FieldTypeManager() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const { FIELD_TYPES, refetch } = useFieldTypes();
  const [editingFieldType, setEditingFieldType] = useState(null);
  const DATA_TYPES = useDataTypes();
  const { t } = useTranslation();

  // Ensure DATA_TYPES is always an array
  const safeDataTypes = Array.isArray(DATA_TYPES) ? DATA_TYPES : [];

  const dataTypeOptions = safeDataTypes.map((dt) => ({
    label: dt.type.charAt(0).toUpperCase() + dt.type.slice(1),
    value: dt.id,
  }));

  const handleAddNew = () => {
    setEditingFieldType(null);
    setIsModalVisible(true);
  };

  const successDelete = (res) => {
    const data = res?.data || res;
    if (data?.status === "failed") {
      Toast.error(data?.message || t("Failed to delete field type"));
      return;
    }
    refetch();
    Toast.success(data?.message || t("Field type deleted successfully!"));
  };

  const handleDelete = async (fieldType) => {
    await deleteCustomFieldType(fieldType.id, successDelete);
  };

  const handleEdit = (fieldType) => {
    setEditingFieldType(fieldType);
    setIsModalVisible(true);
  };

  const handleSubmit = (values, { resetForm }) => {
    const successCallback = (res) => {
      // Handle nested API response structure
      const data = res?.data?.data || res?.data || res;
      if (data?.status === "failed") {
        Toast.error(data?.message || t("Operation failed"));
        return;
      }
      refetch();
      setIsModalVisible(false);
      resetForm();
      Toast.success(
        data?.message ||
          (editingFieldType
            ? t("Field type updated successfully!")
            : t("Field type added successfully!"))
      );
    };

    if (editingFieldType) {
      // Edit mode - call update API
      update_field_type(successCallback, values, editingFieldType.id);
    } else {
      // Add mode - call add API
      add_field_type(successCallback, values);
    }
  };

  const getAvailableValidationRules = (id) => {
    const dt = safeDataTypes.find((d) => d.id === id);
    return dt ? dt.validation_rules : [];
  };

  const formatValidationRules = (validationRules) => {
    if (!validationRules || Object.keys(validationRules).length === 0)
      return "None configured";
    return (
      Object.entries(validationRules)
        .filter(([_, val]) => val !== "" && val != null && val !== false)
        .map(([key, value]) => {
          const config = VALIDATION_FIELD_CONFIGS[key];
          const label = config?.label || key;
          return typeof value === "boolean"
            ? value
              ? label
              : null
            : `${label}: ${value}`;
        })
        .filter(Boolean)
        .join(", ") || "None configured"
    );
  };

  return (
    <>
      <Card>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <Title level={4}>
            <span className="text-text-skin-base">
              {t("Field Type Configuration")}
            </span>
          </Title>
          <Button icon={<NxPlus />} onClick={handleAddNew} type="primary" size="middle">
            {t("Add New Field Type")}
          </Button>
        </div>

        <div style={{ maxHeight: "400px", overflowY: "auto" }}>
          <List
            dataSource={FIELD_TYPES}
            renderItem={(ft) => (
              <List.Item
                actions={
                  !ft.default && [
                    <Button
                      icon={<NxEdit />}
                      onClick={() => handleEdit(ft)}
                    />,
                    <Button
                      onClick={() => handleDelete(ft)}
                      icon={<NxTrash />}
                      danger
                    />,
                  ]
                }
              >
                <List.Item.Meta
                  title={
                    <span className="text-text-skin-base">{ft.label}</span>
                  }
                  description={
                    <Space direction="vertical">
                      <Text type="secondary">
                        <span className="text-text-skin-secondary">
                          Type:{" "}
                          {safeDataTypes.find((dt) => dt.id === ft.type_id)?.type}
                        </span>
                      </Text>
                      <Text type="secondary">
                        <span className="text-text-skin-secondary">
                          Available Rules:{" "}
                          {safeDataTypes.find(
                            (dt) => dt.id === ft.type_id,
                          )?.validation_rules?.join(", ") || "None"}
                        </span>
                      </Text>
                      <Text type="secondary">
                        <span className="text-text-skin-secondary">
                          {" "}
                          Configured Values:{" "}
                          {formatValidationRules(ft.validation_rules)}
                        </span>
                      </Text>
                      {ft.dynamic && (
                        <Text type="secondary">
                          <span className="text-text-skin-secondary">
                            Dynamic: Yes | Endpoint:{" "}
                            {ft.end_point || "Not configured"}
                          </span>
                        </Text>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      </Card>

      <Modal
        title={
          <span className="text-text-skin-base">
            {editingFieldType ? t("Edit Field Type") : t("Add New Field Type")}
          </span>
        }
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={800}
      >
        <Formik
          initialValues={{
            label: editingFieldType?.label || "",
            type_id: editingFieldType?.type_id || undefined,
            dynamic: editingFieldType?.dynamic || false,
            end_point: editingFieldType?.end_point || "",
            validation_rules: editingFieldType?.validation_rules || {},
            field_type_id: editingFieldType?.id,
          }}
          onSubmit={handleSubmit}
          enableReinitialize
        >
          {(formik) => {
            const selectedType = safeDataTypes.find(
              (dt) => dt.id === formik.values.type_id,
            );
            const shouldShowDynamic = [
              "select",
              // "radio", "checkbox"
            ].includes(selectedType?.type);

            return (
              <AntForm layout="vertical" onFinish={formik.handleSubmit}>
                <AntForm.Item
                  label={
                    <span className="text-text-skin-base">{t("Label")}</span>
                  }
                  required
                >
                  <Input
                    name="label"
                    value={formik.values.label}
                    onChange={formik.handleChange}
                    placeholder={t("Field Type Label")}
                  />
                </AntForm.Item>
                <AntForm.Item
                  label={
                    <span className="text-text-skin-base">
                      {t("Data Type")}
                    </span>
                  }
                  required
                >
                  <Select
                    placeholder={t("Select data type")}
                    options={dataTypeOptions}
                    value={formik.values.type_id}
                    onChange={(val) => {
                      const selected = safeDataTypes.find((dt) => dt.id === val);
                      const rules = {};
                      selected?.validation_rules?.forEach((rule) => {
                        const config = VALIDATION_FIELD_CONFIGS[rule];
                        if (config) rules[rule] = config.defaultValue;
                      });
                      formik.setFieldValue("type_id", val);
                      formik.setFieldValue("validation_rules", rules);
                      formik.setFieldValue("dynamic", false);
                      formik.setFieldValue("end_point", "");
                    }}
                  />
                </AntForm.Item>

                {shouldShowDynamic && (
                  <AntForm.Item>
                    <Checkbox
                      checked={formik.values.dynamic}
                      onChange={(e) =>
                        formik.setFieldValue("dynamic", e.target.checked)
                      }
                    >
                      {t("Dynamic field (requires endpoint)")}
                    </Checkbox>
                  </AntForm.Item>
                )}

                {shouldShowDynamic && formik.values.dynamic && (
                  <AntForm.Item label={t("API Endpoint")}>
                    <Input
                      name="end_point"
                      value={formik.values.end_point}
                      onChange={formik.handleChange}
                      placeholder={t("API endpoint")}
                    />
                  </AntForm.Item>
                )}

                {getAvailableValidationRules(formik.values.type_id).length >
                  0 && (
                  <Collapse>
                    <Panel
                      header={
                        <span className="text-text-skin-bases">
                          {t("Configure Validation Rules")}
                        </span>
                      }
                      key="validation"
                    >
                      <Row gutter={16}>
                        {getAvailableValidationRules(formik.values.type_id).map(
                          (rule) => {
                            const config = VALIDATION_FIELD_CONFIGS[rule];
                            if (!config) return null;

                            const fieldPath = `validation_rules.${rule}`;
                            const value =
                              formik.values.validation_rules?.[rule];

                            return (
                              <Col span={8} key={rule}>
                                <AntForm.Item
                                  label={
                                    <span className="text-text-skin-secondary">
                                      {config.label}
                                    </span>
                                  }
                                >
                                  {config.type === "number" ? (
                                    <InputNumber
                                      value={value}
                                      min={config.min}
                                      style={{ width: "100%" }}
                                      onChange={(val) =>
                                        formik.setFieldValue(fieldPath, val)
                                      }
                                    />
                                  ) : config.type === "checkbox" ? (
                                    <Checkbox
                                      checked={value}
                                      onChange={(e) =>
                                        formik.setFieldValue(
                                          fieldPath,
                                          e.target.checked,
                                        )
                                      }
                                    >
                                      {config.label}
                                    </Checkbox>
                                  ) : config.type === "date" ? (
                                    <Input
                                      type="date"
                                      value={value}
                                      onChange={(e) =>
                                        formik.setFieldValue(
                                          fieldPath,
                                          e.target.value,
                                        )
                                      }
                                    />
                                  ) : config.type === "time" ? (
                                    <Input
                                      type="time"
                                      value={value}
                                      onChange={(e) =>
                                        formik.setFieldValue(
                                          fieldPath,
                                          e.target.value,
                                        )
                                      }
                                    />
                                  ) : (
                                    <Input
                                      value={value}
                                      onChange={(e) =>
                                        formik.setFieldValue(
                                          fieldPath,
                                          e.target.value,
                                        )
                                      }
                                      placeholder={
                                        config.placeholder ||
                                        config.defaultValue
                                      }
                                    />
                                  )}
                                </AntForm.Item>
                              </Col>
                            );
                          },
                        )}
                      </Row>
                    </Panel>
                  </Collapse>
                )}

                <div style={{ textAlign: "right", marginTop: 20 }}>
                  <Button
                    onClick={() => setIsModalVisible(false)}
                    style={{ marginRight: 8 }}
                  >
                    {t("Cancel")}
                  </Button>
                  <Button type="primary" htmlType="submit">
                    {editingFieldType ? t("Update") : t("Add")}
                  </Button>
                </div>
              </AntForm>
            );
          }}
        </Formik>
      </Modal>
    </>
  );
}
