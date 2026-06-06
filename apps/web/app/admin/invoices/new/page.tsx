import { Suspense } from 'react';
import NewInvoiceForm from './NewInvoiceForm';

export default function NewInvoicePage() {
  return (
    <Suspense>
      <NewInvoiceForm />
    </Suspense>
  );
}
