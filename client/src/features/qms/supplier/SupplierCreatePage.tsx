import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  Button,
  Badge,
} from '@/components/ui';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import { useCreateSupplier } from './hooks';

interface CertEntry {
  name: string;
  certificateNumber: string;
  issuedBy: string;
  expiryDate: string;
}

const emptyCert: CertEntry = {
  name: '',
  certificateNumber: '',
  issuedBy: '',
  expiryDate: '',
};

const certOptions = [
  { value: 'ISO 9001:2015', label: 'ISO 9001:2015' },
  { value: 'IATF 16949:2016', label: 'IATF 16949:2016' },
  { value: 'ISO 14001:2015', label: 'ISO 14001:2015' },
  { value: 'ISO 45001:2018', label: 'ISO 45001:2018' },
  { value: 'AS9100D', label: 'AS9100D' },
  { value: 'NADCAP', label: 'NADCAP' },
  { value: 'Other', label: 'Other' },
];

export default function SupplierCreatePage() {
  const navigate = useNavigate();
  const createSupplier = useCreateSupplier();

  const [companyName, setCompanyName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [productsServices, setProductsServices] = useState('');
  const [certifications, setCertifications] = useState<CertEntry[]>([{ ...emptyCert }]);

  const updateCert = (index: number, field: keyof CertEntry, value: string) => {
    setCertifications((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addCert = () => {
    setCertifications((prev) => [...prev, { ...emptyCert }]);
  };

  const removeCert = (index: number) => {
    if (certifications.length <= 1) return;
    setCertifications((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createSupplier.mutateAsync({
        companyName, code, category, contactPerson, email, phone,
        address, city, state, productsServices, certifications,
      });
    } catch {
      // falls through — mock mode
    }
    navigate('/qms/suppliers');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/qms/suppliers')}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Add Supplier</h1>
          <p className="mt-1 text-sm text-slate-500">
            Register a new supplier in the quality management system
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Information */}
        <Card>
          <CardHeader>
            <CardTitle>Company Information</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              label="Company Name"
              placeholder="e.g., Tata Steel Ltd"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
            <Input
              label="Supplier Code"
              placeholder="e.g., SUP-009"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <Select
              label="Category"
              placeholder="Select category"
              options={[
                { value: 'CRITICAL', label: 'Critical' },
                { value: 'MAJOR', label: 'Major' },
                { value: 'MINOR', label: 'Minor' },
              ]}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            />
          </div>
        </Card>

        {/* Contact Details */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Details</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              label="Contact Person"
              placeholder="Full name"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              required
            />
            <Input
              label="Email"
              type="email"
              placeholder="email@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Phone"
              type="tel"
              placeholder="+91 XXXX XXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <div className="sm:col-span-2 lg:col-span-3">
              <Input
                label="Address"
                placeholder="Street address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
            </div>
            <Input
              label="City"
              placeholder="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
            />
            <Input
              label="State"
              placeholder="State"
              value={state}
              onChange={(e) => setState(e.target.value)}
              required
            />
          </div>
        </Card>

        {/* Products & Services */}
        <Card>
          <CardHeader>
            <CardTitle>Products & Services</CardTitle>
          </CardHeader>
          <Textarea
            label="Products / Services"
            placeholder="Enter products or services supplied, one per line"
            value={productsServices}
            onChange={(e) => setProductsServices(e.target.value)}
            required
          />
        </Card>

        {/* Certifications */}
        <Card>
          <CardHeader>
            <CardTitle>Certifications</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addCert}>
              <Plus className="h-4 w-4" />
              Add Certification
            </Button>
          </CardHeader>

          <div className="space-y-4">
            {certifications.map((cert, index) => (
              <div
                key={index}
                className="relative border border-surface-border rounded-lg p-4 bg-surface-secondary/20"
              >
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="outline">Certification {index + 1}</Badge>
                  {certifications.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCert(index)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Select
                    label="Standard"
                    placeholder="Select standard"
                    options={certOptions}
                    value={cert.name}
                    onChange={(e) => updateCert(index, 'name', e.target.value)}
                  />
                  <Input
                    label="Certificate Number"
                    placeholder="e.g., QMS-2024-001"
                    value={cert.certificateNumber}
                    onChange={(e) => updateCert(index, 'certificateNumber', e.target.value)}
                  />
                  <Input
                    label="Issued By"
                    placeholder="e.g., Bureau Veritas"
                    value={cert.issuedBy}
                    onChange={(e) => updateCert(index, 'issuedBy', e.target.value)}
                  />
                  <Input
                    label="Expiry Date"
                    type="date"
                    value={cert.expiryDate}
                    onChange={(e) => updateCert(index, 'expiryDate', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/qms/suppliers')}>
            Cancel
          </Button>
          <Button type="submit">
            Add Supplier
          </Button>
        </div>
      </form>
    </div>
  );
}
