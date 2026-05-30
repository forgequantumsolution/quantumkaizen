import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Formik, Form, type FormikHelpers } from 'formik';
import * as Yup from 'yup';
import { Button as AntButton, Input as AntInput, Form as AntForm } from 'antd';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import './LoginPage.css';

interface FormValues {
  email: string;
  password: string;
}

const validationSchema = Yup.object({
  email: Yup.string().email('Invalid email address').required('Email is required'),
  password: Yup.string().required('Password is required'),
});

const TENANT_CODE = 'AURORA-PH';

const PILLS = [
  'Document Control',
  'CAPA',
  'Risk Management',
  'Training & LMS',
  'Audits',
  '21 CFR Part 11',
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [error, setError] = useState('');

  const handleSubmit = async (values: FormValues, helpers: FormikHelpers<FormValues>) => {
    setError('');
    try {
      await login(values.email, values.password, TENANT_CODE);
      navigate('/dashboard');
    } catch {
      setError('Invalid credentials. Please try again.');
    } finally {
      helpers.setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-overlay" />

      <div className="login-brand">
        <div className="login-brand-eyebrow">
          <span className="login-brand-dot" />
          <span className="login-brand-eyebrow-text">Enterprise Quality Management</span>
        </div>

        <h1 className="login-brand-headline">
          Uncompromising Quality.
          <br />
          <em>Continuous Improvement.</em>
        </h1>

        <p className="login-brand-desc">
          Enterprise QMS for manufacturing and regulated industries — Document Control, CAPA, Risk,
          Training, Audits and 21 CFR Part 11 e-signatures, unified in a single compliance platform.
        </p>

        <div className="login-brand-pills">
          {PILLS.map((p) => (
            <span key={p} className="login-brand-pill">
              {p}
            </span>
          ))}
        </div>
      </div>

      <div className="login-card-wrap">
        <div className="login-card">
          <div className="login-card-top">
            <img src="/golden_blue_logo.png" alt="Quantum Kaizen" className="login-card-logo" />
            <div className="login-card-product">
              Quantum <span>Kaizen</span>
            </div>
          </div>

          <div className="login-card-body">
            <div className="login-card-title-row">
              <h2 className="login-card-title">Sign In</h2>
            </div>

            <Formik<FormValues>
              initialValues={{ email: '', password: '' }}
              validationSchema={validationSchema}
              onSubmit={handleSubmit}
            >
              {({ values, errors, touched, setFieldValue, isSubmitting, handleSubmit }) => (
                <AntForm layout="vertical" component={false}>
                <Form>
                  {(error || (touched.email && errors.email) || (touched.password && errors.password)) && (
                    <div className="login-error">
                      <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                      {error ||
                        (touched.email && errors.email) ||
                        (touched.password && errors.password)}
                    </div>
                  )}

                  <AntForm.Item
                    label="Email address"
                    validateStatus={touched.email && errors.email ? 'error' : ''}
                    className="!mb-3"
                  >
                    <AntInput
                      size="large"
                      prefix={<Mail size={14} className="text-gray-400" />}
                      type="email"
                      value={values.email}
                      onChange={(e) => setFieldValue('email', e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                  </AntForm.Item>

                  <AntForm.Item
                    label="Password"
                    validateStatus={touched.password && errors.password ? 'error' : ''}
                    className="!mb-4"
                  >
                    <AntInput.Password
                      size="large"
                      prefix={<Lock size={14} className="text-gray-400" />}
                      value={values.password}
                      onChange={(e) => setFieldValue('password', e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                  </AntForm.Item>

                  <AntButton
                    type="primary"
                    size="large"
                    htmlType="submit"
                    block
                    loading={isSubmitting}
                    onClick={() => handleSubmit()}
                  >
                    Sign In
                  </AntButton>
                </Form>
                </AntForm>
              )}
            </Formik>
          </div>

          <div className="login-card-footer">
            Powered by Quantum Kaizen · Forge Quantum Solutions
          </div>
        </div>
      </div>
    </div>
  );
}
