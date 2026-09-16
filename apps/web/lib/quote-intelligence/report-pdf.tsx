/**
 * Quote Intelligence Report PDF — @react-pdf/renderer.
 *
 * One to two pages: verdict, what's present, what's missing, questions to
 * ask in writing. Styled to match lib/pdf/quote-document.tsx (same palette,
 * same header/footer shape) so a customer who has already seen an Ecowoods
 * estimate PDF recognizes this as the same business.
 */

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { BUSINESS_NAP, BUSINESS_ADDRESS_LINE } from '@ecowoods/shared/constants';
import type { QuoteIntelligenceReport } from './types';
import { QUOTE_RETENTION_NOTE } from './wording';

const WALNUT = '#1a0f08';
const COPPER = '#c87e4f';
const MUTED = '#6b5d52';
const LINE = '#e8d4b8';
const CREAM = '#faf6ef';

const VERDICT_LABEL: Record<QuoteIntelligenceReport['verdict'], string> = {
  incomplete: 'Incomplete — not enough was scored to reach a verdict',
  defect: 'Unresolved critical item(s) found',
  weak: 'Several gaps found',
  sound: 'Sound',
  strong: 'Strong',
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
  verdictBox: {
    padding: '10px 14px', marginBottom: 18, backgroundColor: CREAM,
    borderLeftWidth: 3, borderLeftColor: COPPER,
  },
  verdictLabel: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: WALNUT },
  verdictPct: { fontSize: 9, color: MUTED, marginTop: 2 },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 10, fontFamily: 'Helvetica-Bold', color: WALNUT,
    backgroundColor: CREAM, padding: '5px 10px', marginBottom: 8,
    borderLeftWidth: 3, borderLeftColor: COPPER,
  },
  bodyText: { fontSize: 9.5, color: WALNUT, lineHeight: 1.6, marginBottom: 6 },
  questionItem: { fontSize: 9.5, color: WALNUT, marginBottom: 5, paddingLeft: 10 },
  refuseItem: { fontSize: 8, color: MUTED, marginBottom: 3 },
  footer: {
    position: 'absolute', bottom: 32, left: 48, right: 48,
    borderTopWidth: 1, borderTopColor: LINE, paddingTop: 8,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  footerText: { fontSize: 7, color: MUTED },
});

export function QuoteIntelligenceReportDocument({ report }: { report: QuoteIntelligenceReport }) {
  return (
    <Document title={`Quote Intelligence Report — ${report.orderId}`} author="Ecowoods Hardwood Flooring Inc.">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brandName}>ECOWOODS</Text>
            <Text style={styles.brandSub}>Quote Intelligence Report</Text>
            <Text style={[styles.brandSub, { marginTop: 2 }]}>{BUSINESS_NAP.phoneDisplay} · {BUSINESS_NAP.email}</Text>
          </View>
          <View>
            <Text style={styles.docTitle}>QUOTE READ</Text>
            <Text style={styles.docRef}>Order: {report.orderId.slice(0, 8).toUpperCase()}</Text>
            <Text style={styles.docRef}>Tier: {report.tier}</Text>
            <Text style={styles.docRef}>Scored: {format(new Date(report.scoredOn), 'MMMM d, yyyy')}</Text>
            <Text style={styles.docRef}>Framework v{report.frameworkVersion}</Text>
          </View>
        </View>

        <View style={styles.verdictBox}>
          <Text style={styles.verdictLabel}>{VERDICT_LABEL[report.verdict]}</Text>
          <Text style={styles.verdictPct}>{report.pct}% of scored criteria met, by {report.estimatorDesk}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WHAT&rsquo;S RIGHT</Text>
          <Text style={styles.bodyText}>{report.present}</Text>
        </View>

        {report.missing && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>WHAT&rsquo;S MISSING</Text>
            <Text style={styles.bodyText}>{report.missing}</Text>
          </View>
        )}

        {report.ifSoundSaySo && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>BOTTOM LINE</Text>
            <Text style={styles.bodyText}>{report.ifSoundSaySo}</Text>
          </View>
        )}

        {report.questionsToAsk.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>QUESTIONS TO SEND BACK IN WRITING</Text>
            {report.questionsToAsk.map((q, i) => (
              <Text key={i} style={styles.questionItem}>• {q.text}</Text>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WHAT THIS REPORT IS NOT</Text>
          {report.refuses.map((r, i) => (
            <Text key={i} style={styles.refuseItem}>• {r}</Text>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.bodyText}>{QUOTE_RETENTION_NOTE}</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{BUSINESS_ADDRESS_LINE}</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
