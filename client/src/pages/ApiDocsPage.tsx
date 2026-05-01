import { Button as AntButton } from 'antd';
import { ExternalLink, Download } from 'lucide-react';

const SWAGGER_URL = '/api/docs/';
const SPEC_URL = '/api/openapi.json';

export default function ApiDocsPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-80px)] animate-fade-in">
      <div className="flex items-center justify-between pb-3 border-b border-gray-200">
        <div>
          <h1 className="text-h1 text-gray-900 mb-0.5">API Documentation</h1>
          <p className="text-sm text-gray-500 mb-0">
            Interactive Swagger UI generated from the live backend. Click <strong>Authorize</strong>{' '}
            and paste your JWT to try endpoints directly.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AntButton
            icon={<Download size={14} />}
            href={SPEC_URL}
            target="_blank"
            rel="noreferrer"
          >
            openapi.json
          </AntButton>
          <AntButton
            type="primary"
            icon={<ExternalLink size={14} />}
            href={SWAGGER_URL}
            target="_blank"
            rel="noreferrer"
          >
            Open in new tab
          </AntButton>
        </div>
      </div>

      <iframe
        src={SWAGGER_URL}
        title="Quantum Kaizen API"
        className="flex-1 w-full border-0 rounded-xl mt-3 bg-white"
      />
    </div>
  );
}
