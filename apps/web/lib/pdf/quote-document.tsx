/**
 * Quote / Estimate PDF document — @react-pdf/renderer
 *
 * Professional estimate document showing scope + itemized pricing.
 * Sent to customer BEFORE contract is created.
 * 견적서: 계약서 생성 전에 고객에게 발송하는 공식 견적 문서
 */

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { QuoteRequest, Settings } from '@prisma/client';
import { format, addDays } from 'date-fns';

const WALNUT = '#1a0f08';
const COPPER = '#c87e4f';
const MUTED  = '#6b5d52';
const LINE   = '#e8d4b8';
const CREAM  = '#faf6ef';

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, color: WALNUT, padding: 48, lineHeight: 1.5 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 32, paddingBottom: 20, borderBottomWidth: 2, borderBottomColor: COPPER,
  },
  brandName: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: WALNUT },
  brandSub:  { fontSize: 8, color: COPPER, marginTop: 3 },
  docTitle:  { fontSize: 20, fontFamily: 'Helvetica-Bold', color: COPPER, textAlign: 'right' },
  docRef:    { fontSize: 9, color: MUTED, textAlign: 'right', marginTop: 4 },
  section:   { marginBottom: 18 },
  sectionTitle: {
    fontSize: 10, fontFamily: 'Helvetica-Bold', color: WALNUT,
    backgroundColor: CREAM, padding: '5px 10px', marginBottom: 8,
    borderLeftWidth: 3, borderLeftColor: COPPER,
  },
  row: { flexDirection: 'row', marginBottom: 4 },
  label: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: MUTED, width: '38%', textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 10, color: WALNUT, flex: 1 },
  tableHeader: { flexDirection: 'row', backgroundColor: WALNUT, padding: '7px 8px' },
  tableHeaderText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: LINE, padding: '7px 8px' },
  tableRowAlt: { backgroundColor: '#faf8f5' },
  colDesc: { width: '50%' }, colQty: { width: '10%', textAlign: 'center' },
  colUnit: { width: '15%', textAlign: 'center' },
  colPrice: { width: '12%', textAlign: 'right' }, colAmt: { width: '13%', textAlign: 'right' },
  cell: { fontSize: 9, color: WALNUT },
  totalsBlock: { marginTop: 20, marginLeft: 'auto', width: '42%' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', padding: '4px 0', borderBottomWidth: 1, borderBottomColor: LINE },
  totalLabel: { fontSize: 9, color: MUTED },
  totalValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: WALNUT },
  grandRow: { flexDirection: 'row', justifyContent: 'space-between', padding: '9px 0', marginTop: 4, borderTopWidth: 2, borderTopColor: COPPER },
  grandLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: WALNUT },
  grandValue: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: COPPER },
  validityBox: {
    marginTop: 28, padding: '10px 14px',
    backgroundColor: CREAM, borderLeftWidth: 3, borderLeftColor: COPPER,
  },
  validityTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: WALNUT, marginBottom: 4 },
  bodyText: { fontSize: 9, color: WALNUT, lineHeight: 1.6, marginBottom: 5 },
  footer: {
    position: 'absolute', bottom: 32, left: 48, right: 48,
    borderTopWidth: 1, borderTopColor: LINE, paddingTop: 8,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  footerText: { fontSize: 7, color: MUTED },
});

type LineItem = { description: string; qty: number; unit: string; unitPrice: number; amount: number };

function cad(n: number) { return `CA$${n.toFixed(2)}`; }

export function QuoteDocument({
  quote,
  settings,
}: {
  quote: QuoteRequest & { quoteLineItems?: unknown; quoteNotes?: string | null; quoteValidUntil?: Date | null };
  settings: Settings;
}) {
  const items: LineItem[] = Array.isArray(quote.quoteLineItems)
    ? (quote.quoteLineItems as LineItem[])
    : typeof quote.quoteLineItems === 'string'
      ? JSON.parse(quote.quoteLineItems as string)
      : [];

  const taxRate     = Number(quote.quoteTaxRate ?? settings.defaultTaxRate ?? 13);
  const subtotal    = Number(quote.quotedAmount ?? items.reduce((s, i) => s + i.amount, 0));
  const taxAmt      = subtotal * taxRate / 100;
  const grandTotal  = subtotal + taxAmt;
  const validUntil  = quote.quoteValidUntil ?? addDays(new Date(), 30);
  const quoteRef    = `EST-${format(new Date(), 'yyyy')}-${quote.id.slice(0, 6).toUpperCase()}`;

  return (
    <Document title={`Estimate — ${quote.name}`} author={settings.companyName ?? ''}>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandName}>{(settings.companyName ?? '').toUpperCase()}</Text>
            <Text style={styles.brandSub}>Premium Hardwood Flooring · Toronto, Ontario, Canada</Text>
            <Text style={[styles.brandSub, { marginTop: 2 }]}>{settings.companyPhone ?? ''} · {settings.companyEmail ?? ''}</Text>
          </View>
          <View>
            <Text style={styles.docTitle}>ESTIMATE</Text>
            <Text style={styles.docRef}>Ref #: {quoteRef}</Text>
            <Text style={styles.docRef}>Date: {format(new Date(), 'MMMM d, yyyy')}</Text>
            <Text style={styles.docRef}>Valid until: {format(validUntil, 'MMMM d, yyyy')}</Text>
          </View>
        </View>

        {/* Prepared for */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PREPARED FOR</Text>
          <View style={styles.row}><Text style={styles.label}>Name</Text><Text style={styles.value}>{quote.name}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Email</Text><Text style={styles.value}>{quote.email}</Text></View>
          {quote.phone && <View style={styles.row}><Text style={styles.label}>Phone</Text><Text style={styles.value}>{quote.phone}</Text></View>}
          {(quote.city || quote.province) && (
            <View style={styles.row}>
              <Text style={styles.label}>Location</Text>
              <Text style={styles.value}>{[quote.address, quote.city, quote.province].filter(Boolean).join(', ')}</Text>
            </View>
          )}
        </View>

        {/* Project summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PROJECT SUMMARY</Text>
          {quote.service && <View style={styles.row}><Text style={styles.label}>Service</Text><Text style={styles.value}>{quote.service}</Text></View>}
          {Array.isArray(quote.species) && (quote.species as string[]).length > 0 && <View style={styles.row}><Text style={styles.label}>Species</Text><Text style={styles.value}>{(quote.species as string[]).join(', ')}</Text></View>}
          {quote.squareFeet && <View style={styles.row}><Text style={styles.label}>Area</Text><Text style={styles.value}>{quote.squareFeet.toLocaleString()} sq ft (approx.)</Text></View>}
          {quote.projectType && <View style={styles.row}><Text style={styles.label}>Project Type</Text><Text style={styles.value}>{quote.projectType.replace('_', ' ')}</Text></View>}
          {quote.timeline && <View style={styles.row}><Text style={styles.label}>Timeline</Text><Text style={styles.value}>{quote.timeline.replace(/_/g, ' ')}</Text></View>}
        </View>

        {/* Line items table */}
        {items.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SCOPE OF WORK & PRICING</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.colDesc]}>Description</Text>
              <Text style={[styles.tableHeaderText, styles.colQty]}>Qty</Text>
              <Text style={[styles.tableHeaderText, styles.colUnit]}>Unit</Text>
              <Text style={[styles.tableHeaderText, styles.colPrice]}>Unit Price</Text>
              <Text style={[styles.tableHeaderText, styles.colAmt]}>Amount</Text>
            </View>
            {items.map((item, i) => (
              <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
                <Text style={[styles.cell, styles.colDesc]}>{item.description}</Text>
                <Text style={[styles.cell, styles.colQty]}>{item.qty}</Text>
                <Text style={[styles.cell, styles.colUnit]}>{item.unit}</Text>
                <Text style={[styles.cell, styles.colPrice]}>{cad(item.unitPrice)}</Text>
                <Text style={[styles.cell, styles.colAmt]}>{cad(item.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Totals */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{cad(subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>HST ({taxRate}%)</Text>
            <Text style={styles.totalValue}>{cad(taxAmt)}</Text>
          </View>
          <View style={styles.grandRow}>
            <Text style={styles.grandLabel}>TOTAL (CAD)</Text>
            <Text style={styles.grandValue}>{cad(grandTotal)}</Text>
          </View>
        </View>

        {/* Notes */}
        {quote.quoteNotes && (
          <View style={[styles.section, { marginTop: 24 }]}>
            <Text style={styles.sectionTitle}>NOTES & CONDITIONS</Text>
            <Text style={styles.bodyText}>{quote.quoteNotes}</Text>
          </View>
        )}

        {/* Validity */}
        <View style={styles.validityBox}>
          <Text style={styles.validityTitle}>Estimate Validity</Text>
          <Text style={styles.bodyText}>
            This estimate is valid until {format(validUntil, 'MMMM d, yyyy')}. Pricing is subject to change after this date.
            To proceed, please reply to this email or call {settings.companyPhone} to schedule an in-home consultation and confirm details.
          </Text>
          <Text style={styles.bodyText}>
            This document is an estimate only and does not constitute a contract.
            A formal contract will be issued upon mutual agreement of scope and pricing.
          </Text>
          {settings.companyNumberHst && (
            <Text style={[styles.bodyText, { marginTop: 4 }]}>HST Registration #: {settings.companyNumberHst}</Text>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{settings.companyName ?? ''} · {settings.companyAddress ?? ''}</Text>
          <Text style={styles.footerText}>Estimate #{quoteRef} · {format(new Date(), 'MMMM d, yyyy')}</Text>
        </View>
      </Page>
    </Document>
  );
}
