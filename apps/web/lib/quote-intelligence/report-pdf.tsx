/**
 * Quote Intelligence Report PDF — @react-pdf/renderer.
 *
 * Page one is the whole answer for a customer who reads nothing else: the
 * statement, one line per quote, the comparison verdict, and how to read the
 * five statuses. Each quote then gets its own section — risk flags, the scope
 * extraction and the framework criteria, each finding shown with the page and
 * wording it was read from — followed by the questions to send back and the
 * published sources every flag rests on.
 *
 * Styled to match lib/pdf/quote-document.tsx (same palette, same header/footer
 * shape) so a customer who has already seen an Ecowoods estimate PDF
 * recognizes this as the same business.
 */

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { BUSINESS_NAP, BUSINESS_ADDRESS_LINE } from '@ecowoods/shared/constants';
import { SITE_URL } from '@/lib/seo-data';
import type { Evidence, FindingStatus, QuoteIntelligenceReport, QuoteReadout, RiskFlag, Verdict } from './types';
import { FINDING_STATUSES } from './types';
import { QUOTE_RETENTION_NOTE, REPORT_LIMITS_NOTE, STATUS_LABEL, STATUS_MEANING } from './wording';

const WALNUT = '#1a0f08';
const COPPER = '#c87e4f';
const MUTED = '#6b5d52';
const LINE = '#e8d4b8';
const CREAM = '#faf6ef';
const RED = '#9b2c1f';

/*
 * Line height is set on each text style, NEVER on the Page. A unitless
 * lineHeight on the Page is inherited by the `fixed` footer, and react-pdf
 * re-resolves an inherited unitless value against the font size every time it
 * repaints a fixed element — so it compounds once per page. A three-quote
 * report reached 4e23 by page 11 and pdfkit threw "unsupported number".
 * report-pdf.test.ts renders a three-quote report to catch this.
 */
const TEXT_LINE_HEIGHT = 1.45;

const VERDICT_LABEL: Record<Verdict, string> = {
  incomplete: 'Incomplete — not enough could be scored to reach a verdict',
  defect: 'Critical item(s) not stated in the quote',
  weak: 'Several gaps against the framework',
  sound: 'Sound against the framework criteria',
  strong: 'Strong against the framework criteria',
};

const LEVEL_LABEL: Record<RiskFlag['level'], string> = { high: 'HIGH', medium: 'MEDIUM', low: 'LOW' };

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9.5, color: WALNUT, padding: 48, paddingBottom: 64 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 22, paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: COPPER,
  },
  brandName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: WALNUT },
  brandSub: { fontSize: 8, color: COPPER, marginTop: 3 },
  docTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: COPPER, textAlign: 'right' },
  docRef: { fontSize: 8.5, color: MUTED, textAlign: 'right', marginTop: 3 },
  statementBox: { padding: '10px 14px', marginBottom: 14, backgroundColor: CREAM, borderLeftWidth: 3, borderLeftColor: COPPER },
  statement: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: WALNUT },
  summaryLine: { fontSize: 9, color: WALNUT, marginTop: 4, lineHeight: TEXT_LINE_HEIGHT },
  section: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 10, fontFamily: 'Helvetica-Bold', color: WALNUT, backgroundColor: CREAM,
    padding: '5px 10px', marginBottom: 7, borderLeftWidth: 3, borderLeftColor: COPPER,
  },
  quoteTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: COPPER, marginBottom: 4 },
  bodyText: { fontSize: 9.5, color: WALNUT, lineHeight: 1.55, marginBottom: 5 },
  small: { fontSize: 8, color: MUTED, lineHeight: TEXT_LINE_HEIGHT },
  bullet: { fontSize: 9.5, color: WALNUT, marginBottom: 4, paddingLeft: 10, lineHeight: TEXT_LINE_HEIGHT },
  legendRow: { flexDirection: 'row', marginBottom: 3 },
  legendTerm: { width: 110, fontSize: 8.5, fontFamily: 'Helvetica-Bold' },
  legendText: { flex: 1, fontSize: 8.5, color: WALNUT, lineHeight: TEXT_LINE_HEIGHT },
  flag: { marginBottom: 6, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: LINE },
  flagHead: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', lineHeight: TEXT_LINE_HEIGHT },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: LINE, paddingVertical: 3 },
  headRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COPPER, paddingBottom: 3, marginBottom: 1 },
  th: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: MUTED },
  td: { fontSize: 8.5, color: WALNUT, paddingRight: 6, lineHeight: TEXT_LINE_HEIGHT },
  evidence: { fontSize: 8, color: MUTED, fontFamily: 'Helvetica-Oblique', lineHeight: TEXT_LINE_HEIGHT },
  footer: {
    position: 'absolute', bottom: 28, left: 48, right: 48,
    borderTopWidth: 1, borderTopColor: LINE, paddingTop: 6,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  footerText: { fontSize: 7, color: MUTED },
});

function evidenceText(e: Evidence | undefined): string {
  if (!e) return '';
  return `${e.page ? `p.${e.page} ` : ''}“${e.excerpt}”`;
}

function sourceUrl(href: string): string {
  return href.startsWith('http') ? href : `${SITE_URL}${href}`;
}

function flagCounts(r: QuoteReadout): string {
  const high = r.riskFlags.filter((f) => f.level === 'high').length;
  const medium = r.riskFlags.filter((f) => f.level === 'medium').length;
  return `${high} high / ${medium} medium risk flag(s)`;
}

function Flags({ flags }: { flags: RiskFlag[] }) {
  return (
    <>
      {flags.map((f, i) => (
        <View key={i} style={styles.flag} wrap={false}>
          <Text style={[styles.flagHead, f.level === 'high' ? { color: RED } : {}]}>
            {LEVEL_LABEL[f.level]} · {f.text}
          </Text>
          {f.consequence && <Text style={styles.bodyText}>{f.consequence}</Text>}
          {f.basisHref && <Text style={styles.small}>Source: {sourceUrl(f.basisHref)}</Text>}
        </View>
      ))}
    </>
  );
}

function QuoteSection({ quote }: { quote: QuoteReadout }) {
  return (
    <View break>
      <Text style={styles.quoteTitle}>{quote.label}</Text>
      <Text style={styles.small}>
        {VERDICT_LABEL[quote.verdict]} · {quote.pct}% of weighted framework criteria stated in the document · {flagCounts(quote)}
      </Text>
      <Text style={[styles.small, { marginBottom: 10 }]}>
        {FINDING_STATUSES.map((s) => `${STATUS_LABEL[s]}: ${quote.counts[s]}`).join(' · ')}
      </Text>

      {quote.riskFlags.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RISK FLAGS</Text>
          <Flags flags={quote.riskFlags} />
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SCOPE — WHAT THE DOCUMENT STATES</Text>
        <View style={styles.headRow}>
          <Text style={[styles.th, { width: '38%' }]}>Item</Text>
          <Text style={[styles.th, { width: '18%' }]}>Status</Text>
          <Text style={[styles.th, { width: '44%' }]}>Where it was read</Text>
        </View>
        {quote.scope.map((s) => (
          <View key={s.id} style={styles.row} wrap={false}>
            <Text style={[styles.td, { width: '38%' }]}>{s.label}</Text>
            <Text style={[styles.td, { width: '18%' }]}>{STATUS_LABEL[s.status]}</Text>
            <Text style={[styles.evidence, { width: '44%' }]}>{evidenceText(s.evidence)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>WELL-INSTALLED FRAMEWORK CRITERIA</Text>
        <View style={styles.headRow}>
          <Text style={[styles.th, { width: '7%' }]}>#</Text>
          <Text style={[styles.th, { width: '45%' }]}>Criterion</Text>
          <Text style={[styles.th, { width: '16%' }]}>Status</Text>
          <Text style={[styles.th, { width: '32%' }]}>Where it was read</Text>
        </View>
        {quote.criteria.map((c) => (
          <View key={c.id} style={styles.row} wrap={false}>
            <Text style={[styles.td, { width: '7%' }]}>{c.id}</Text>
            <Text style={[styles.td, { width: '45%' }]}>
              {c.question}
              {c.severity === 'critical' ? ' (critical)' : ''}
            </Text>
            <Text style={[styles.td, { width: '16%' }]}>{STATUS_LABEL[c.status]}</Text>
            <Text style={[styles.evidence, { width: '32%' }]}>{evidenceText(c.evidence)}</Text>
          </View>
        ))}
      </View>

      {quote.questionsToAsk.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>QUESTIONS TO SEND BACK IN WRITING — {quote.label.toUpperCase()}</Text>
          {quote.questionsToAsk.map((q, i) => (
            <Text key={i} style={styles.bullet}>
              {i + 1}. {q.text}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function StatusCell({ status }: { status: FindingStatus }) {
  return <Text style={[styles.td, status === 'verified' ? {} : { fontFamily: 'Helvetica-Bold' }]}>{STATUS_LABEL[status]}</Text>;
}

export function QuoteIntelligenceReportDocument({ report }: { report: QuoteIntelligenceReport }) {
  const { comparison } = report;
  const quoteColWidth = `${Math.floor(60 / Math.max(1, report.quotes.length))}%`;
  const sources = [
    ...new Set(
      [...report.generalRiskFlags, ...report.quotes.flatMap((q) => q.riskFlags)]
        .map((f) => f.basisHref)
        .filter((h): h is string => Boolean(h))
        .map((h) => h.split('#')[0]),
    ),
  ].sort();

  return (
    <Document title={`Quote Intelligence Report — ${report.orderId}`} author="Ecowoods Hardwood Flooring Inc.">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header} fixed>
          <View>
            <Text style={styles.brandName}>ECOWOODS</Text>
            <Text style={styles.brandSub}>Quote Intelligence Report</Text>
            <Text style={[styles.brandSub, { marginTop: 2 }]}>
              {BUSINESS_NAP.phoneDisplay} · {BUSINESS_NAP.email}
            </Text>
          </View>
          <View>
            <Text style={styles.docTitle}>QUOTE READ</Text>
            <Text style={styles.docRef}>Order: {report.orderId.slice(0, 8).toUpperCase()}</Text>
            <Text style={styles.docRef}>Tier: {report.tier}</Text>
            <Text style={styles.docRef}>Read on: {format(new Date(report.scoredOn), 'MMMM d, yyyy')}</Text>
            <Text style={styles.docRef}>Framework v{report.frameworkVersion}</Text>
          </View>
        </View>

        <View style={styles.statementBox}>
          <Text style={styles.statement}>{report.statement}</Text>
          {report.quotes.map((q) => (
            <Text key={q.label} style={styles.summaryLine}>
              {q.label} — {VERDICT_LABEL[q.verdict]} · {q.pct}% of criteria stated · {flagCounts(q)}
            </Text>
          ))}
          {comparison && <Text style={styles.summaryLine}>Comparison: {comparison.statement}</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>HOW TO READ THIS REPORT</Text>
          {FINDING_STATUSES.map((s) => (
            <View key={s} style={styles.legendRow}>
              <Text style={styles.legendTerm}>{STATUS_LABEL[s]}</Text>
              <Text style={styles.legendText}>{STATUS_MEANING[s]}</Text>
            </View>
          ))}
          <Text style={[styles.small, { marginTop: 5 }]}>{REPORT_LIMITS_NOTE}</Text>
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

        {report.generalRiskFlags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>RISK FLAGS ACROSS THE QUOTES</Text>
            <Flags flags={report.generalRiskFlags} />
          </View>
        )}

        {comparison && (
          <View style={styles.section} break>
            <Text style={styles.sectionTitle}>SIDE BY SIDE — ARE THESE THE SAME JOB?</Text>
            <Text style={styles.bodyText}>{comparison.statement}</Text>
            <Text style={[styles.small, { marginBottom: 6 }]}>
              Only the wording of each document is compared. No price is put on any difference, and no company is ranked.
            </Text>
            <View style={styles.headRow}>
              <Text style={[styles.th, { width: '40%' }]}>Scope item</Text>
              {report.quotes.map((q) => (
                <Text key={q.label} style={[styles.th, { width: quoteColWidth }]}>
                  {q.label}
                </Text>
              ))}
            </View>
            {comparison.matrix.map((row) => (
              <View key={row.id} style={styles.row} wrap={false}>
                <Text style={[styles.td, { width: '40%' }]}>
                  {row.label}
                  {row.changesScope ? '' : ' (certainty, not scope)'}
                </Text>
                {row.statuses.map((s, i) => (
                  <View key={i} style={{ width: quoteColWidth }}>
                    <StatusCell status={s} />
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {report.quotes.map((q) => (
          <QuoteSection key={q.label} quote={q} />
        ))}

        <View break>
          {report.generalQuestions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>QUESTIONS FOR EVERY QUOTE</Text>
              {report.generalQuestions.map((q, i) => (
                <Text key={i} style={styles.bullet}>
                  {i + 1}. {q.text}
                </Text>
              ))}
            </View>
          )}

          {sources.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PUBLISHED SOURCES THESE FLAGS REST ON</Text>
              {sources.map((s) => (
                <Text key={s} style={styles.bullet}>
                  • {sourceUrl(s)}
                </Text>
              ))}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>WHAT THIS REPORT IS NOT</Text>
            {report.refuses.map((r, i) => (
              <Text key={i} style={styles.bullet}>
                • {r}
              </Text>
            ))}
            <Text style={[styles.bodyText, { marginTop: 4 }]}>{REPORT_LIMITS_NOTE}</Text>
            <Text style={styles.bodyText}>{QUOTE_RETENTION_NOTE}</Text>
            <Text style={styles.small}>Read by the {report.estimatorDesk}.</Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{BUSINESS_ADDRESS_LINE}</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
