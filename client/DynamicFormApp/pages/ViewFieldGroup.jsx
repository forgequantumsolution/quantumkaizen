import { useEffect, useState } from "react";
import PreviewFieldGroupBuilder from "./PreviewFieldGroupBuilder";
import { useParams } from "react-router";
import { useTranslation } from "react-i18next";
import PageWrapper from "@/components/UI/PageWrapper";
import { Card, Skeleton, Empty, Typography, Space, NxFileText } from "@nexgensis/core";

const { Title, Text } = Typography;

function ViewFieldGroup() {
  const [formSchema, setformSchema] = useState({
    fields: [],
    sections: [],
  });
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();
  const { id } = useParams();

  useEffect(() => {
    if (id) {
      setLoading(true);
      try {
        const groups = JSON.parse(localStorage.getItem("field_group_templates") || "[]");
        const group = groups.find((g) => g.id === id);
        if (group) {
          setformSchema({
            sections: group.sections || [],
            fields: group.fields || [],
            title: group.title || "",
            description: group.description || "",
          });
        }
      } catch {
        // leave default empty state
      }
      setLoading(false);
    }
  }, [id]);

  if (loading) {
    return (
      <PageWrapper
        title={t("Field Group Preview")}
        subTitle={t("Loading field group details...")}
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
        title={t("Field Group Preview")}
        subTitle={t("View the field group configuration")}
        showBack={true}
      >
        <Card className="text-center py-12">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Space direction="vertical">
                <Text type="secondary">{t("No field group data found")}</Text>
                <Text type="secondary" className="text-sm">
                  {t("The field group might not exist or has no sections configured.")}
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
      title={t("Field Group Preview")}
      subTitle={t(
        "View the details of the field group that was successfully configured."
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
        {/* Gradient Header */}
        <div
          className="px-5 py-4"
          style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          }}
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
                  {formSchema?.title || t("Untitled Field Group")}
                </Title>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Form Preview Section */}
      <Card
        title={
          <div className="flex items-center gap-2 text-lg font-medium">
            <NxFileText className="text-blue-600" />
            <span>{t("Field Group Preview")}</span>
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
        <PreviewFieldGroupBuilder formSchema={formSchema} />
      </Card>
    </PageWrapper>
  );
}

export default ViewFieldGroup;
