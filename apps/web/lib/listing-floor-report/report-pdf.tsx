/**
 * Pre-List Floor Condition Report PDF (EW-0003) — @react-pdf/renderer.
 * Same palette/shape as lib/pdf/quote-document.tsx and
 * lib/quote-intelligence/report-pdf.tsx, reimplemented here rather than
 * imported so this product has no runtime dependency on EW-0002's files.
 */

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { BUSINESS_NAP, BUSINESS_ADDRESS_LINE } from '@ecowoods/shared/constants';
import type { Certainty, ListingFloorReport } from './types';

const WALNUT = '#1a0f08';
const COPPER = '#c87e4f';
const MUTED = '#6b5d52';
const LINE = '#e8d4b8';
const CREAM = '#faf6ef';

const RECOMMENDATION_LABEL: Record<ListingFloorReport['recommendation'], string> = {
  recoat_ok: 'Recoat before photography is realistic on this timeline',
  sand_required: 'A recoat will not resolve this — full sand is not a three-day product',
  leave_it: 'No work indicated ahead of listing',
  cannot_determine_from_photos: 'Cannot determine from photos — see the onsite letter',
};

const CERTAINTY_LABEL: Record<Certainty, string> = {
  verified: 'Customer-asserted from the document/photos',
  not_specified: 'Not specified',
  unclear: 'Unclear',
  cannot_determine: 'Cannot determine',
  inspection_needed: 'Requires in-person inspection',
};

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
  recBox: {
    padding: '10px 14px', marginBottom: 18, backgroundColor: CREAM,
    borderLeftWidth: 3, borderLeftColor: COPPER,
  },
  recLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: WALNUT },
  recBand: { fontSize: 9, color: MUTED, marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 10, fontFamily: 'Helvetica-Bold', color: WALNUT,
    backgroundColor: CREAM, padding: '5px 10px', marginBottom: 8,
    borderLeftWidth: 3, borderLeftColor: COPPER,
  },
  bodyText: { fontSize: 9.5, color: WALNUT, lineHeight: 1.6, marginBottom: 6 },
  row: { flexDirection: 'row', marginBottom: 4 },
  label: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: MUTED, width: '38%' },
  value: { fontSize: 9.5, color: WALNUT, flex: 1 },
  questionItem: { fontSize: 9.5, color: WALNUT, marginBottom: 5, paddingLeft: 10 },
  refuseItem: { fontSize: 8, color: MUTED, marginBottom: 3 },
  footer: {
    position: 'absolute', bottom: 32, left: 48, right: 48,
    borderTopWidth: 1, borderTopColor: LINE, paddingTop: 8,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  footerText: { fontSize: 7, color: MUTED },
});

export function ListingFloorReportDocument({ report }: { report: ListingFloorReport }) {
  return (
    <Document title={`Pre-List Floor Condition Report — ${report.orderId}`} author="Ecowoods Hardwood Flooring Inc.">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brandName}>ECOWOODS</Text>
            <Text style={styles.brandSub}>Pre-List Floor Condition Report</Text>
            <Text style={[styles.brandSub, { marginTop: 2 }]}>{BUSINESS_NAP.phoneDisplay} · {BUSINESS_NAP.email}</Text>
          </View>
          <View>
            <Text style={styles.docTitle}>{report.sku === 'onsite' ? 'ONSITE LETTER' : 'PHOTO REPORT'}</Text>
            <Text style={styles.docRef}>Order: {report.orderId.slice(0, 8).toUpperCase()}</Text>
            <Text style={styles.docRef}>Scored: {format(new Date(report.scoredOn), 'MMMM d, yyyy')}</Text>
          </View>
        </View>

        <View style={styles.recBox}>
          <Text style={styles.recLabel}>{RECOMMENDATION_LABEL[report.recommendation]}</Text>
          {report.band && <Text style={styles.recBand}>{report.band} — {report.bandCaption}</Text>}
        </View>

        {report.schedule.feasible && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>THREE-DAY SCHEDULE, COUNTED BACK FROM PHOTOGRAPHY</Text>
            <View style={styles.row}><Text style={styles.label}>Day 1 — abrade</Text><Text style={styles.value}>{format(new Date(report.schedule.day1), 'EEEE, MMMM d')}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Day 2 — coat</Text><Text style={styles.value}>{format(new Date(report.schedule.day2), 'EEEE, MMMM d')}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Day 3 — cure / photography</Text><Text style={styles.value}>{format(new Date(report.schedule.day3), 'EEEE, MMMM d')}</Text></View>
          </View>
        )}

        {!report.schedule.feasible && report.schedule.reason === 'window_closed' && (
          <View style={styles.section}>
            <Text style={styles.bodyText}>
              There is not enough working-day runway before the photography date for a three-day recoat.
              The next window could realistically start {format(new Date(report.schedule.nextWindowStart), 'MMMM d, yyyy')}.
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WHAT WAS SEEN</Text>
          <View style={styles.row}><Text style={styles.label}>Finish wear</Text><Text style={styles.value}>{CERTAINTY_LABEL[report.findings.finishWear]}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Wood damage</Text><Text style={styles.value}>{CERTAINTY_LABEL[report.findings.woodDamage]}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Moisture</Text><Text style={styles.value}>{CERTAINTY_LABEL[report.findings.moisture]}</Text></View>
          <Text style={[styles.bodyText, { marginTop: 8 }]}>{report.present}</Text>
        </View>

        {report.missing && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>WHAT COULDN&rsquo;T BE DETERMINED</Text>
            <Text style={styles.bodyText}>{report.missing}</Text>
          </View>
        )}

        {report.askInWriting.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>QUESTIONS FOR THE CONTRACTOR, IN WRITING</Text>
            {report.askInWriting.map((q, i) => (
              <Text key={i} style={styles.questionItem}>• {q}</Text>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WHAT THIS REPORT IS NOT</Text>
          {report.refuses.map((r, i) => (
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
