/**
 * Personal Floor Plan specification PDF (EW-0004) — @react-pdf/renderer.
 * Same palette/shape as the other paid-report PDFs on this branch,
 * reimplemented locally rather than imported — this product has no runtime
 * dependency on EW-0002/EW-0003's files.
 */

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { BUSINESS_NAP, BUSINESS_ADDRESS_LINE } from '@ecowoods/shared/constants';
import type { FloorPlanSpec } from './spec';

const WALNUT = '#1a0f08';
const COPPER = '#c87e4f';
const MUTED = '#6b5d52';
const LINE = '#e8d4b8';
const CREAM = '#faf6ef';

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, color: WALNUT, padding: 48, lineHeight: 1.5 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 28, paddingBottom: 18, borderBottomWidth: 2, borderBottomColor: COPPER,
  },
  brandName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: WALNUT },
  brandSub: { fontSize: 8, color: COPPER, marginTop: 3 },
  docTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: COPPER, textAlign: 'right' },
  docRef: { fontSize: 9, color: MUTED, textAlign: 'right', marginTop: 4 },
  rangeBox: {
    padding: '10px 14px', marginBottom: 18, backgroundColor: CREAM,
    borderLeftWidth: 3, borderLeftColor: COPPER,
  },
  rangeLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: WALNUT },
  rangeNote: { fontSize: 8, color: MUTED, marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 10, fontFamily: 'Helvetica-Bold', color: WALNUT,
    backgroundColor: CREAM, padding: '5px 10px', marginBottom: 8,
    borderLeftWidth: 3, borderLeftColor: COPPER,
  },
  row: { flexDirection: 'row', marginBottom: 4 },
  label: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: MUTED, width: '38%' },
  value: { fontSize: 9.5, color: WALNUT, flex: 1 },
  bodyText: { fontSize: 9.5, color: WALNUT, lineHeight: 1.6, marginBottom: 6 },
  checklistItem: { fontSize: 9, color: WALNUT, marginBottom: 4, paddingLeft: 10 },
  refuseItem: { fontSize: 8, color: MUTED, marginBottom: 3 },
  footer: {
    position: 'absolute', bottom: 32, left: 48, right: 48,
    borderTopWidth: 1, borderTopColor: LINE, paddingTop: 8,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  footerText: { fontSize: 7, color: MUTED },
});

function money(n: number, currency: string): string {
  return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'en-CA', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function FloorPlanDocument({ spec }: { spec: FloorPlanSpec }) {
  return (
    <Document title={`Personal Floor Plan — ${spec.designRef}`} author="Ecowoods Hardwood Flooring Inc.">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brandName}>ECOWOODS</Text>
            <Text style={styles.brandSub}>Personal Floor Plan</Text>
            <Text style={[styles.brandSub, { marginTop: 2 }]}>{BUSINESS_NAP.phoneDisplay} · {BUSINESS_NAP.email}</Text>
          </View>
          <View>
            <Text style={styles.docTitle}>SPECIFICATION</Text>
            <Text style={styles.docRef}>Reference: {spec.designRef}</Text>
            <Text style={styles.docRef}>Prepared: {format(new Date(spec.scoredOn), 'MMMM d, yyyy')}</Text>
          </View>
        </View>

        <View style={styles.rangeBox}>
          <Text style={styles.rangeLabel}>{spec.summary}</Text>
          <Text style={styles.rangeNote}>
            Indicative installed range: {money(spec.estimateLow, spec.currency)}–{money(spec.estimateHigh, spec.currency)}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SPECIFICATION</Text>
          <View style={styles.row}><Text style={styles.label}>Species</Text><Text style={styles.value}>{spec.species}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Finish</Text><Text style={styles.value}>{spec.finish}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Pattern / direction of lay</Text><Text style={styles.value}>{spec.pattern}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Board width</Text><Text style={styles.value}>{spec.width}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Area</Text><Text style={styles.value}>{spec.squareFeet.toLocaleString('en-CA')} sq ft</Text></View>
        </View>

        {spec.movementSentence && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SEASONAL MOVEMENT, THIS WIDTH</Text>
            <Text style={styles.bodyText}>{spec.movementSentence}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BEFORE THIS GOES DOWN — WHAT THE MEASURE CONFIRMS</Text>
          {spec.checklist.map((item) => (
            <Text key={item.id} style={styles.checklistItem}>• {item.question}</Text>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WHAT THIS SPECIFICATION IS NOT</Text>
          {spec.refuses.map((r, i) => (
            <Text key={i} style={styles.refuseItem}>• {r}</Text>
          ))}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{BUSINESS_ADDRESS_LINE}</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
