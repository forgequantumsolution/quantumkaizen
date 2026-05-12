import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Drawer,
  Button,
  Upload,
  Table,
  Message
} from '@nexgensis/core';
import {
  NxDownload,
  NxUpload as UploadIcon,
  NxFileSpreadsheet,
  NxCheckCircle2,
  NxAlertCircle,
  NxFileUp,
  NxX
} from '@nexgensis/core';

const { Dragger } = Upload;

const BulkUploadFormsModal = ({ open, onClose, onDownloadTemplate, onUpload }) => {
  const { t } = useTranslation();
  const [fileList, setFileList] = useState([]);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [serverResponse, setServerResponse] = useState(null);

  const uploadProps = {
    name: 'file',
    multiple: false,
    accept: '.xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel',
    fileList,
    beforeUpload: (file) => {
      const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.type === 'application/vnd.ms-excel';
      if (!isExcel) {
        Message.error(t('You can only upload Excel files!'));
        return false;
      }
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        Message.error(t('File must be smaller than 10MB!'));
        return false;
      }
      setFileList([file]);
      setSelectedFile(file);
      setUploadError(null);
      setServerResponse(null);
      return false;
    },
    onRemove: () => {
      setFileList([]);
      setSelectedFile(null);
      setUploadComplete(false);
      setUploadError(null);
      setServerResponse(null);
    },
    maxCount: 1
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    try {
      const res = await onUpload(selectedFile);
      setServerResponse(res || null);

      if (res?.status === 'failed') {
        setUploadComplete(false);
        setUploadError({
          message: res?.message || t('Upload failed.'),
          errors: Array.isArray(res?.errors) ? res.errors : null,
          total_errors: res?.total_errors ?? (Array.isArray(res?.errors) ? res.errors.length : 0),
        });
      } else {
        setUploadError(null);
        setUploadComplete(true);
      }
    } catch (err) {
      setUploadComplete(false);
      const apiMsg =
        err?.response?.data?.message ||
        err?.message ||
        t('Upload failed due to a network or server error.');
      setUploadError({
        message: apiMsg,
        errors: Array.isArray(err?.response?.data?.errors) ? err.response.data.errors : null,
        total_errors: err?.response?.data?.total_errors,
      });
    }
  };

  const handleForceApply = async () => {
    if (!selectedFile) return;
    try {
      const res = await onUpload(selectedFile, { auto_create_missing: true });
      setServerResponse(res || null);

      if (res?.status === 'failed') {
        setUploadComplete(false);
        setUploadError({
          message: res?.message || t('Upload failed.'),
          errors: Array.isArray(res?.errors) ? res.errors : null,
          total_errors: res?.total_errors ?? (Array.isArray(res?.errors) ? res.errors.length : 0),
        });
      } else {
        setUploadError(null);
        setUploadComplete(true);
      }
    } catch (err) {
      setUploadComplete(false);
      const apiMsg =
        err?.response?.data?.message ||
        err?.message ||
        t('Upload failed due to a network or server error.');
      setUploadError({
        message: apiMsg,
        errors: Array.isArray(err?.response?.data?.errors) ? err.response.data.errors : null,
        total_errors: err?.response?.data?.total_errors,
      });
    }
  };

  const handleClose = () => {
    setFileList([]);
    setSelectedFile(null);
    setUploadComplete(false);
    setUploadError(null);
    setServerResponse(null);
    onClose();
  };

  const errorColumns = [
    {
      title: t('Row'),
      dataIndex: 'row',
      key: 'row',
      width: 60,
      render: (text) => text ?? '-'
    },
    {
      title: t('Type'),
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (text) => text ?? '-'
    },
    {
      title: t('Column'),
      dataIndex: 'column',
      key: 'column',
      width: 100,
      render: (text) => text ?? '-'
    },
    {
      title: t('Invalid Value'),
      dataIndex: 'invalid_value',
      key: 'invalid_value',
      width: 120,
      render: (text) => text ?? '-'
    },
    {
      title: t('Message'),
      dataIndex: 'message',
      key: 'message',
      render: (text) => text ?? '-'
    }
  ];

  return (
    <Drawer
      title={
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 backdrop-blur-md rounded-xl flex items-center justify-center">
            <NxFileUp size={22} strokeWidth={2} />
          </div>
          <div>
            <h2 className="m-0 text-xl font-semibold text-text-skin-base">
              {t('Bulk Upload Forms')}
            </h2>
            <p className="mt-0.5 mb-0 text-xs text-text-skin-base">
              {t('Upload multiple forms using Excel template')}
            </p>
          </div>
        </div>
      }
      placement="right"
      open={open}
      onClose={handleClose}
      width={600}
      destroyOnClose
      styles={{
        body: { padding: '16px' }
      }}
    >
      {/* Step 1: Download Template */}
      <div className="border border-border-skin-base rounded-xl p-3 mb-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-800 rounded-lg flex items-center justify-center flex-shrink-0">
              <NxDownload size={18} color="white" strokeWidth={2} />
            </div>
            <div>
            <div className="text-xs font-semibold text-skin-button-base tracking-wider">
                {t('STEP 1')}
              </div>
              <h3 className="m-0 text-base font-semibold text-text-skin-base">
                {t('Download Excel Template')}
              </h3>
            </div>
          </div>
          <Button
            type="primary"
            size="medium"
            onClick={onDownloadTemplate}
            className="h-7 !p-3 bg-blue-800 border-none rounded-lg font-semibold flex items-center gap-1.5"
          >
            <NxDownload size={16} />
          {t('Download')}
          </Button>
        </div>

        {/* Guidelines */}
        <div className="border border-border-skin-base rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <NxAlertCircle size={16} color="#1e40af" />
            <span className="text-xs font-semibold text-text-skin-base">
              {t('Important Guidelines')}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {[
              t('Fill in all required details'),
              t('Do not modify or delete column headers'),
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <div className="w-1 h-1 bg-gray-600 rounded-full mt-1.5 flex-shrink-0" />
                <span className="text-xs text-text-skin-secondary leading-normal">
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step 2: Upload File */}
      <div className={`border rounded-xl p-3 ${uploadComplete ? 'border-green-500' : 'border-border-skin-base'}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${uploadComplete ? 'bg-green-500' : 'bg-blue-800'}`}>
              {uploadComplete ? (
                <NxCheckCircle2 size={18} color="white" strokeWidth={2} />
              ) : (
                <UploadIcon size={18} color="white" strokeWidth={2} />
              )}
            </div>
            <div>
              <div className={`text-xs font-semibold tracking-wider ${uploadComplete ? 'text-green-500' : 'text-skin-button-base'}`}>
                {t('STEP 2')}
              </div>
              <h3 className="m-0 text-base font-semibold text-text-skin-base">
                {t('Upload Completed Template')}
              </h3>
            </div>
          </div>
          {selectedFile && !uploadComplete && (
            <Button
              type="primary"
              size="medium"
              onClick={handleUpload}
              className="h-7 !p-3 bg-blue-800 border-none rounded-lg font-semibold shadow-md shadow-blue-800/20 flex items-center gap-1.5"
            >
              <UploadIcon size={16} />
              {t('Upload')}
            </Button>
          )}
        </div>

        <Dragger
          {...uploadProps}
          className="border border-dashed border-gray-200"
          showUploadList={{
            showRemoveIcon: true,
            removeIcon: true,
          }}
          style={{
            '--antd-upload-list-item-actions-opacity': '1',
          }}
          itemRender={(_originNode, file, _fileList, actions) => (
            <div className="flex items-center justify-between p-2 mt-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <NxFileSpreadsheet size={20} className="text-green-600 shrink-0" />
                <span className="text-sm text-text-skin-base truncate">{file.name}</span>
              </div>
              <Button
                type="text"
                size="small"
                danger
                onClick={() => actions.remove()}
                className="shrink-0 ml-2"
                icon={<NxX size={16} />}
              />
            </div>
          )}
        >
          <div className="py-2 px-2">
            <div className="w-8 h-8 mx-auto bg-blue-50 rounded-full flex items-center justify-center">
              <NxFileSpreadsheet size={18} color="#1e40af" strokeWidth={2} />
            </div>
            <p className="mt-1 mb-0.5 text-sm font-semibold text-text-skin-base">
              {t('Drag & drop your file here')}
            </p>
            <p className="m-0 text-xs text-text-skin-secondary">
              {t('or')} <span className="text-blue-800 font-semibold cursor-pointer">{t('browse')}</span> {t('to upload')}
            </p>
            <p className="mt-1 mb-0 text-xs text-text-skin-secondary">
              {t('Supported formats: .xlsx, .xls • Max size: 10MB')}
            </p>
          </div>
        </Dragger>

        {/* Error Panel */}
        {uploadError && (
          <div className="mt-3 p-2.5 rounded-lg border border-red-300 bg-red-50">
            <div className="text-red-700 text-sm font-semibold">
              {uploadError.message || t('Upload failed.')}
            </div>
            {Array.isArray(uploadError.errors) && uploadError.errors.length > 0 && (
              <div className="mt-2">
                <div className="text-xs text-red-700 mb-1">
                  {t('Total Errors')}: {uploadError.total_errors ?? uploadError.errors.length}
                </div>
                <Table
                  dataSource={uploadError.errors}
                  columns={errorColumns}
                  size="small"
                  pagination={false}
                  scroll={{ y: 200 }}
                  rowKey={(record, index) => index}
                  className="mt-2"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
};

export default BulkUploadFormsModal;
