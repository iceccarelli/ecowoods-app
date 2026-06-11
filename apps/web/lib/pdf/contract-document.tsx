/**
 * Contract PDF document — rendered with @react-pdf/renderer
 *
 * Professional flooring contract with all standard clauses.
 * Built to match Ecowoods' premium brand identity.
 *
 * 계약서 PDF: 전문적인 마루 설치 계약서 레이아웃
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import type { Project, User, Settings } from '@prisma/client';
import { format } from 'date-fns';

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
    lineHeight: 1.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: COPPER,
  },
  brandName: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: WALNUT,
  },
  brandSub: {
    fontSize: 8,
    color: COPPER,
    marginTop: 3,
  },
  contractTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: COPPER,
    textAlign: 'right',
  },
  contractNum: {
    fontSize: 9,
    color: MUTED,
    textAlign: 'right',
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: WALNUT,
    backgroundColor: CREAM,
    padding: '6px 10px',
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: COPPER,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: MUTED,
    width: '35%',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 10,
    color: WALNUT,
    flex: 1,
  },
  bodyText: {
    fontSize: 9,
    color: WALNUT,
    lineHeight: 1.6,
    marginBottom: 6,
  },
  clauseTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: WALNUT,
    marginBottom: 3,
    marginTop: 8,
  },
  signatureSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 40,
  },
  signatureBlock: {
    width: '45%',
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: WALNUT,
    marginBottom: 4,
    height: 40,
  },
  signatureLabel: {
    fontSize: 9,
    color: MUTED,
    lineHeight: 1.6,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 48,
    right: 48,
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 7,
    color: MUTED,
  },
  highlight: {
    backgroundColor: CREAM,
    padding: '8px 12px',
    marginVertical: 8,
    borderLeftWidth: 2,
    borderLeftColor: COPPER,
  },
  highlightText: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: WALNUT,
  },
});

function cad(amount: number) {
  return `CA$${amount.toFixed(2)}`;
}

type ProjectWithRelations = Project & { user: User };

export function ContractDocument({
  project,
  settings,
}: {
  project: ProjectWithRelations;
  settings: Settings;
}) {
  const customer = project.user;
  const contractDate = format(new Date(), 'MMMM d, yyyy');
  const contractRef = `ECW-${format(new Date(), 'yyyy')}-${project.id.slice(0, 6).toUpperCase()}`;

  const taxRate = Number(project.taxRate ?? settings.defaultTaxRate ?? 13);
  const contractValuePlusTax = project.contractValue
    ? Number(project.contractValue) * (1 + taxRate / 100)
    : null;

  return (
    <Document title={`Contract — ${project.title}`} author={settings.companyName ?? ''}>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandName}>{(settings.companyName ?? '').toUpperCase()}</Text>
            <Text style={styles.brandSub}>Premium Hardwood Flooring — Toronto, Ontario, Canada</Text>
            <Text style={[styles.brandSub, { marginTop: 2 }]}>
              {settings.companyPhone ?? ''} · {settings.companyEmail ?? ''}
            </Text>
          </View>
          <View>
            <Text style={styles.contractTitle}>SERVICES AGREEMENT</Text>
            <Text style={styles.contractNum}>Contract #: {contractRef}</Text>
            <Text style={styles.contractNum}>Date: {contractDate}</Text>
          </View>
        </View>

        {/* Parties */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. PARTIES</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Contractor:</Text>
            <Text style={styles.value}>{settings.companyName ?? ''}, {settings.companyAddress ?? ''}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Client:</Text>
            <Text style={styles.value}>{customer.name ?? customer.email}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Client Email:</Text>
            <Text style={styles.value}>{customer.email}</Text>
          </View>
          {customer.phone && (
            <View style={styles.row}>
              <Text style={styles.label}>Client Phone:</Text>
              <Text style={styles.value}>{customer.phone}</Text>
            </View>
          )}
        </View>

        {/* Project Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. PROJECT DETAILS</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Project Title:</Text>
            <Text style={styles.value}>{project.title}</Text>
          </View>
          {project.address && (
            <View style={styles.row}>
              <Text style={styles.label}>Project Address:</Text>
              <Text style={styles.value}>{[project.address, project.city, project.province].filter(Boolean).join(', ')}</Text>
            </View>
          )}
          {Array.isArray(project.species) && (project.species as string[]).length > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>Species:</Text>
              <Text style={styles.value}>{(project.species as string[]).join(', ')}</Text>
            </View>
          )}
          {project.squareFeet && (
            <View style={styles.row}>
              <Text style={styles.label}>Area:</Text>
              <Text style={styles.value}>{project.squareFeet.toLocaleString()} sq ft (approximate)</Text>
            </View>
          )}
          {project.startDate && (
            <View style={styles.row}>
              <Text style={styles.label}>Planned Start:</Text>
              <Text style={styles.value}>{format(project.startDate, 'MMMM d, yyyy')}</Text>
            </View>
          )}
          {project.endDate && (
            <View style={styles.row}>
              <Text style={styles.label}>Planned Completion:</Text>
              <Text style={styles.value}>{format(project.endDate, 'MMMM d, yyyy')}</Text>
            </View>
          )}
          {project.description && (
            <View style={[styles.row, { marginTop: 8 }]}>
              <Text style={styles.label}>Scope of Work:</Text>
              <Text style={[styles.value, { lineHeight: 1.6 }]}>{project.description}</Text>
            </View>
          )}
        </View>

        {/* Financial Terms */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. FINANCIAL TERMS</Text>
          {project.contractValue && (
            <>
              <View style={styles.row}>
                <Text style={styles.label}>Contract Value (excl. tax):</Text>
                <Text style={styles.value}>{cad(Number(project.contractValue))}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>HST ({taxRate}%):</Text>
                <Text style={styles.value}>{cad(Number(project.contractValue) * taxRate / 100)}</Text>
              </View>
              <View style={styles.highlight}>
                <Text style={styles.highlightText}>
                  Total Contract Value (incl. HST): {contractValuePlusTax ? cad(contractValuePlusTax) : '—'}
                </Text>
              </View>
              <Text style={[styles.bodyText, { marginTop: 6 }]}>
                Payment Schedule: Deposit {Number(project.depositPct ?? settings.defaultDepositPct)}% upon signing ·
                Progress payment {Number(project.midpointPct ?? settings.defaultMidpointPct)}% at project midpoint ·
                Final balance {Number(project.finalPct ?? settings.defaultFinalPct)}% upon completion
              </Text>
            </>
          )}
          {settings.companyNumberHst && (
            <Text style={styles.bodyText}>
              HST Registration Number: {settings.companyNumberHst}
            </Text>
          )}
        </View>

        {/* Terms & Conditions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. TERMS &amp; CONDITIONS</Text>

          <Text style={styles.clauseTitle}>4.1 Workmanship Warranty</Text>
          <Text style={styles.bodyText}>
            Ecowoods provides a lifetime workmanship warranty for all installation and finishing work performed under this agreement, valid for as long as the Client owns the property. Material warranties are provided by manufacturers and passed through to the Client. The warranty covers defects in workmanship only and does not cover damage from misuse, water flooding, pet damage, or failure to maintain appropriate humidity levels (35–55% RH).
          </Text>

          <Text style={styles.clauseTitle}>4.2 Scope Changes</Text>
          <Text style={styles.bodyText}>
            Any changes to the scope of work must be agreed upon in writing by both parties and may result in price adjustments. Verbal change orders are not binding.
          </Text>

          <Text style={styles.clauseTitle}>4.3 Site Conditions</Text>
          <Text style={styles.bodyText}>
            Client must ensure the premises are accessible, heated to 60–80°F, and cleared of furniture as agreed. Ecowoods is not responsible for delays caused by site inaccessibility or subfloor conditions not disclosed prior to project commencement.
          </Text>

          <Text style={styles.clauseTitle}>4.4 Payment Terms</Text>
          <Text style={styles.bodyText}>
            Invoices are due within 7 days of issuance. A 1.5% monthly interest charge applies to balances outstanding beyond 30 days. Ecowoods reserves the right to suspend work on unpaid accounts.
          </Text>

          <Text style={styles.clauseTitle}>4.5 Governing Law</Text>
          <Text style={styles.bodyText}>
            This agreement is governed by the laws of the Province of Ontario and the federal laws of Canada applicable therein. Any disputes shall be resolved through binding arbitration in Toronto, Ontario.
          </Text>
        </View>

        {/* Signatures */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>
              Authorized by: {settings.companyName ?? ''}{'\n'}
              Name: ____________________________{'\n'}
              Title: ____________________________{'\n'}
              Date: ____________________________
            </Text>
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>
              Client Signature{'\n'}
              Name: {customer.name ?? '____________________________'}{'\n'}
              Date: ____________________________
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Contract #{contractRef} · {settings.companyName ?? ''}
          </Text>
          <Text style={styles.footerText}>
            Page 1 of 1 · Generated {contractDate}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
