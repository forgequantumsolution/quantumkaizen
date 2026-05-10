import React, { useState } from "react";
import { Form, Input, Button, Toast } from "@nexgensis/core";
import { useTranslation } from "react-i18next";
import { SpellCheckInput, SpellCheckTextArea } from "@/components/SpellCheck";

const CreateFieldGroupForm = ({ onClose, onSubmit, initialValues }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values) => {
    try {
      setLoading(true);

      // Call the parent onSubmit handler
      if (onSubmit) {
        onSubmit(values);
      }

      form.resetFields();
      if (onClose) onClose();
    } catch (error) {
      Toast.error(t("Failed to save field group"));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    form.resetFields();
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={initialValues || {}}
    >
      {/* Title Field */}
      <Form.Item
        label={t("Title")}
        name="title"
        rules={[
          {
            required: true,
            message: t("Please enter field group title"),
          },
        ]}
        className="mb-4"
      >
        <SpellCheckInput
          placeholder={t("Enter Title")}
          size="large"
        />
      </Form.Item>

      {/* Description Field */}
      <Form.Item
        label={t("Description")}
        name="description"
        rules={[
          {
            required: true,
            message: t("Please enter field group description"),
          },
        ]}
        className="mb-4"
      >
        <SpellCheckTextArea
          placeholder={t("Enter description")}
          rows={3}
          size="large"
        />
      </Form.Item>

      {/* Action Buttons */}
      <Form.Item className="mb-0">
        <div className="flex justify-end gap-3 mt-2">
          <Button
            size="large"
            onClick={handleReset}
            disabled={loading}
          >
            {t("Reset")}
          </Button>
          <Button
            type="primary"
            size="large"
            htmlType="submit"
            loading={loading}
          >
            {t("Submit")}
          </Button>
        </div>
      </Form.Item>
    </Form>
  );
};

export default CreateFieldGroupForm;
