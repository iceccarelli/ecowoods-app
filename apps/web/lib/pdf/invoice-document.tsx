/**
 * Invoice PDF document — rendered with @react-pdf/renderer
 *
 * Professional invoice layout matching Ecowoods brand:
 * warm walnut colors, clean typography, HST breakdown.
 *
 * Usage:
 *   const pdfBuffer = await renderToBuffer(<InvoiceDocument invoice={...} settings={...} />);
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import type { Invoice, Project, User, Settings } from '@prisma/client';
import { format } from 'date-fns';

// Brand colors
const WALNUT = '#1a0f08';
const COPPER = '#c87e4f';
const MUTED = '#6b5d52';
const LINE = '#e8d4b8';
const CREAM = '#faf6ef';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: WALNUT,
    backgroundColor: '#ffffff',
    padding: 48,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 36,
    paddingBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: COPPER,
  },
  brandName: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: WALNUT,
    letterSpacing: 1,
  },
  brandTagline: {
    fontSize: 9,
    color: COPPER,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  invoiceLabel: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: COPPER,
    textAlign: 'right',
  },
  invoiceNumber: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: WALNUT,
    textAlign: 'right',
    marginTop: 4,
  },
  addresses: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  addressBlock: {
    width: '45%',
  },
  addressLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  addressLine: {
    fontSize: 10,
    lineHeight: 1.5,
    color: WALNUT,
  },
  metaBox: {
    backgroundColor: CREAM,
    padding: 12,
    marginBottom: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaItem: {
    flexDirection: 'column',
  },
  metaLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  metaValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: WALNUT,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: WALNUT,
    padding: 8,
  },
  tableHeaderText: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    padding: '8px 8px',
  },
  tableRowAlt: {
    backgroundColor: '#faf8f5',
  },
  tableCell: {
    fontSize: 10,
    color: WALNUT,
    lineHeight: 1.4,
  },
  col1: { width: '50%' },
  col2: { width: '15%', textAlign: 'center' },
  col3: { width: '20%', textAlign: 'right' },
  col4: { width: '15%', textAlign: 'right' },
  totals: {
    marginTop: 24,
    marginLeft: 'auto',
    width: '45%',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: '5px 0',
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  totalLabel: {
    fontSize: 10,
    color: MUTED,
  },
  totalValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: WALNUT,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: '10px 0',
    marginTop: 4,
    borderTopWidth: 2,
    borderTopColor: COPPER,
  },
  grandTotalLabel: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: WALNUT,
  },
  grandTotalValue: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: COPPER,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 48,
    right: 48,
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 8,
    color: MUTED,
    lineHeight: 1.5,
  },
  paySection: {
    marginTop: 36,
    padding: 16,
    backgroundColor: CREAM,
    borderLeftWidth: 3,
    borderLeftColor: COPPER,
  },
  payLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: WALNUT,
    marginBottom: 6,
  },
  payText: {
    fontSize: 9,
    color: MUTED,
    lineHeight: 1.6,
  },
});

type LineItem = { description: string; qty: number; unitPrice: number; amount: number };

type InvoiceWithRelations = Invoice & {
  project: Project & { user: User };
};

function cad(amount: number | { toNumber(): number }) {
  const n = typeof amount === 'number' ? amount : amount.toNumber();
  return `CA$${n.toFixed(2)}`;
}

export function InvoiceDocument({
  invoice,
  settings,
}: {
  invoice: InvoiceWithRelations;
  settings: Settings;
}) {
  const lineItems: LineItem[] = typeof invoice.lineItems === 'string'
    ? JSON.parse(invoice.lineItems)
    : (invoice.lineItems as LineItem[]);

  const customer = invoice.project.user;

  return (
    <Document title={`Invoice ${invoice.number ?? ''}`} author={settings.companyName ?? ''}>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandName}>{(settings.companyName ?? '').toUpperCase()}</Text>
            <Text style={styles.brandTagline}>Premium Hardwood Flooring · Toronto, Canada</Text>
          </View>
          <View>
            <Text style={styles.invoiceLabel}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>#{invoice.number ?? ''}</Text>
          </View>
        </View>

        {/* Addresses */}
        <View style={styles.addresses}>
          <View style={styles.addressBlock}>
            <Text style={styles.addressLabel}>From</Text>
            <Text style={styles.addressLine}>{settings.companyName ?? ''}</Text>
            <Text style={styles.addressLine}>{settings.companyAddress ?? ''}</Text>
            <Text style={styles.addressLine}>Tel: {settings.companyPhone ?? ''}</Text>
            <Text style={styles.addressLine}>{settings.companyEmail ?? ''}</Text>
            {settings.companyNumberHst && (
              <Text style={styles.addressLine}>HST #: {settings.companyNumberHst}</Text>
            )}
          </View>
          <View style={styles.addressBlock}>
            <Text style={styles.addressLabel}>Bill To</Text>
            <Text style={styles.addressLine}>{customer.name ?? customer.email}</Text>
            <Text style={styles.addressLine}>{customer.email}</Text>
            {customer.phone && <Text style={styles.addressLine}>{customer.phone}</Text>}
          </View>
        </View>

        {/* Meta */}
        <View style={styles.metaBox}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Invoice Date</Text>
            <Text style={styles.metaValue}>
              {invoice.issuedAt ? format(invoice.issuedAt, 'MMMM d, yyyy') : format(invoice.createdAt, 'MMMM d, yyyy')}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Due Date</Text>
            <Text style={styles.metaValue}>
              {invoice.dueDate ? format(invoice.dueDate, 'MMMM d, yyyy') : 'Upon Receipt'}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Project</Text>
            <Text style={styles.metaValue}>{invoice.project.title.slice(0, 40)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Stage</Text>
            <Text style={styles.metaValue}>{invoice.stage ?? ''}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Status</Text>
            <Text style={[styles.metaValue, { color: invoice.status === 'PAID' ? '#4a7c59' : COPPER }]}>
              {invoice.status}
            </Text>
          </View>
        </View>

        {/* Description */}
        {invoice.description && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 10, color: MUTED, lineHeight: 1.5 }}>{invoice.description}</Text>
          </View>
        )}

        {/* Line items table */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.col1]}>Description</Text>
          <Text style={[styles.tableHeaderText, styles.col2]}>Qty</Text>
          <Text style={[styles.tableHeaderText, styles.col3]}>Unit Price</Text>
          <Text style={[styles.tableHeaderText, styles.col4]}>Amount</Text>
        </View>

        {lineItems.map((item, i) => (
          <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
            <Text style={[styles.tableCell, styles.col1]}>{item.description}</Text>
            <Text style={[styles.tableCell, styles.col2]}>{item.qty}</Text>
            <Text style={[styles.tableCell, styles.col3]}>{cad(item.unitPrice)}</Text>
            <Text style={[styles.tableCell, styles.col4]}>{cad(item.amount)}</Text>
          </View>
        ))}

        {/* Totals */}
        {(() => {
          const sub = Number(invoice.subtotal);
          const disc = Number(invoice.discountPct);
          const sur = Number(invoice.surchargePct);
          const tax = Number(invoice.taxRate);
          return (
            <View style={styles.totals}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>{cad(sub)}</Text>
              </View>
              {disc > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Discount ({disc}%)</Text>
                  <Text style={[styles.totalValue, { color: '#4a7c59' }]}>−{cad(sub * disc / 100)}</Text>
                </View>
              )}
              {sur > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Surcharge ({sur}%)</Text>
                  <Text style={styles.totalValue}>+{cad(sub * sur / 100)}</Text>
                </View>
              )}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>HST ({tax}%)</Text>
                <Text style={styles.totalValue}>
                  {cad((sub * (1 - disc / 100) * (1 + sur / 100)) * tax / 100)}
                </Text>
              </View>
              <View style={styles.grandTotalRow}>
                <Text style={styles.grandTotalLabel}>TOTAL (CAD)</Text>
                <Text style={styles.grandTotalValue}>{cad(Number(invoice.total))}</Text>
              </View>
            </View>
          );
        })()}

        {/* Payment instructions */}
        {invoice.status !== 'PAID' && (
          <View style={styles.paySection}>
            <Text style={styles.payLabel}>Payment Instructions</Text>
            <Text style={styles.payText}>
              Pay online at: ecowoods.ca/mypage/invoices{'\n'}
              Or e-transfer to: accounting@ecowoods.ca (memo: #{invoice.number ?? ''}){'\n'}
              Questions? Call (647) 244-5156 or email {settings.companyEmail ?? ''}
            </Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {settings.companyName ?? ''} · {settings.companyAddress ?? ''}
            {settings.companyNumberHst ? `
HST Registration #: ${settings.companyNumberHst}` : ''}
          </Text>
          <Text style={styles.footerText}>
            Invoice #{invoice.number ?? ''} · Page 1{'\n'}
            Generated {format(new Date(), 'MMMM d, yyyy')}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
