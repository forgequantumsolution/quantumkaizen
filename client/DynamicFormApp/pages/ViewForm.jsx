import { useEffect, useState } from "react";
import FormViewer from "./FormViewer";
import { useParams } from "react-router";
import { get_form_fields } from "../api/dynamic-form-api";
import { useTranslation } from "react-i18next";
import PageWrapper from "@/components/UI/PageWrapper";
import { Card, Tag, Skeleton, Empty, Typography, Space, Badge, NxFileText, NxCalendar, NxTag, NxGitBranch, NxLayoutGrid } from "@nexgensis/core";

const { Title, Text } = Typography;

function ViewForm() {
  const [formSchema, setformSchema] = useState({
    fields: [],
    sections: [],
  });
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();
  const { id } = useParams();

  const success_get_form_fields = (res) => {
    setLoading(false);
    if (res.status === 200) {
      // API response structure: res.data = { status, message, data: { form_id, form_details, sections } }
      const formData = res.data?.data || res.data;

      // Normalize the data structure: convert fields to fields and fields to fields
      const normalizedSections = formData?.sections?.map(section => {
        const fields = section.fields || section.fields || [];

        // For each field, if it's a table type, convert fields to fields
        const normalizedFields = fields.map(field => {
          if (field.type === 'table' && field.fields) {
            return {
              ...field,
              fields: field.fields,
              defaultValues: field.value || []  // Copy value to defaultValues for TableViewer
            };
          }
          return field;
        });

        return {
          ...section,
          fields: normalizedFields
        };
      }) || [];
      setformSchema({ ...formData, sections: normalizedSections, fields: [] });
    } else {
      setformSchema({
        sections: [],
        fields: [],
      });
    }
  };

  useEffect(() => {
    if (id) {
      setLoading(true);
      get_form_fields(success_get_form_fields, {
        id,
      });
    }
  }, [id]);

  // Calculate form statistics
  const totalSections = formSchema?.sections?.length || 0;
  const totalFields = formSchema?.sections?.reduce(
    (acc, section) => acc + (section.fields?.length || 0),
    0
  ) || 0;
  const requiredFields = formSchema?.sections?.reduce(
    (acc, section) => acc + (section.fields?.filter(f => f.required)?.length || 0),
    0
  ) || 0;

  if (loading) {
    return (
      <PageWrapper
        title={t("Template Preview")}
        subTitle={t("Loading form details...")}
        showBack={true}
      >
        <Card className="mb-6">
          <Skeleton active paragraph={{ rows: 4 }} />
        </Card>
        <Card>
          <Skeleton active paragraph={{ rows: 8 }} />
        </Card>
      </PageWrapper>
    );
  }

  if (!formSchema?.sections?.length) {
    return (
      <PageWrapper
        title={t("Template Preview")}
        subTitle={t("View the form template configuration")}
        showBack={true}
      >
        <Card className="text-center py-12">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Space direction="vertical">
                <Text type="secondary">{t("No form data found")}</Text>
                <Text type="secondary" className="text-sm">
                  {t("The form might not exist or has no sections configured.")}
                </Text>
              </Space>
            }
          />
        </Card>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      title={t("Template Preview")}
      subTitle={t(
        "View the details of the form that was successfully configured."
      )}
      showBack={true}
    >
      {/* Form Header - Compact */}
      <Card
        className="mb-4 overflow-hidden"
        styles={{
          body: { padding: 0 }
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 bg-primary-600"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{
                  background: "rgba(255, 255, 255, 0.2)",
                }}
              >
                <NxFileText size={24} color="#fff" />
              </div>
              <div>
                <Title level={3} style={{ color: "#fff", margin: 0 }}>
                  {formSchema?.form_details?.title || t("Untitled Form")}
                </Title>
              </div>
            </div>
            <Badge
              count={`v${formSchema?.form_details?.version || 1}`}
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                color: "#fff",
                fontWeight: 600,
                fontSize: 14,
                padding: "4px 12px",
                height: "auto",
                borderRadius: 12,
              }}
            />
          </div>
        </div>

        {/* Form Metadata - Compact inline */}
        <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex flex-wrap items-center gap-5 text-base">
            <div className="flex items-center gap-2">
              <NxTag className="text-blue-600 dark:text-blue-400" />
              <Text type="secondary">{t("Type")}:</Text>
              <Text strong>{formSchema?.form_details?.form_type || "-"}</Text>
            </div>
            <div className="flex items-center gap-2">
              <NxCalendar className="text-green-600 dark:text-green-400" />
              <Text type="secondary">{t("Created")}:</Text>
              <Text strong>
                {formSchema?.form_details?.created_on
                  ? new Date(formSchema.form_details.created_on).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : "-"}
              </Text>
            </div>
            {formSchema?.form_details?.workflow_name && (
              <div className="flex items-center gap-2">
                <NxGitBranch className="text-purple-600 dark:text-purple-400" />
                <Text type="secondary">{t("Workflow")}:</Text>
                <Text strong>{formSchema.form_details.workflow_name}</Text>
              </div>
            )}
            <div className="flex items-center gap-2">
              <NxLayoutGrid className="text-orange-600 dark:text-orange-400" />
              <Text strong>
                {totalSections} {t("sections")} | {totalFields} {t("fields")} | {requiredFields} {t("required")}
              </Text>
            </div>
          </div>
        </div>
      </Card>

      {/* Section Overview - Compact inline display */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Text type="secondary" className="text-base font-medium">{t("Sections")}:</Text>
        {formSchema?.sections?.map((section, idx) => (
          <Tag
            key={idx}
            color="blue"
            className="px-3 py-1.5 text-sm rounded"
          >
            {idx + 1}. {section.section_name}
            <span className="ml-1 opacity-70">
              ({section.fields?.length || 0})
            </span>
          </Tag>
        ))}
      </div>

      {/* Form Preview Section */}
      <Card
        title={
          <div className="flex items-center gap-2 text-lg font-medium">
            <NxFileText className="text-blue-600" />
            <span>{t("Form Preview")}</span>
          </div>
        }
        className="shadow-sm"
        styles={{
          header: {
            borderBottom: "1px solid #f0f0f0",
            padding: "12px 20px",
          },
          body: {
            padding: "20px 24px",
          },
        }}
      >
        <FormViewer formSchema={formSchema} showSubmit={false} isPreviewMode={true} />
      </Card>
    </PageWrapper>
  );
}

export default ViewForm;
