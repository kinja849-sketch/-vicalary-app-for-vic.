import { createAdminSupabaseClient } from '@/lib/supabase-server';

export interface ReconciliationResult {
  transactionId: string;
  status: 'unmatched' | 'possible_match' | 'matched' | 'merged';
  linkedTransactionId?: string;
}

export class TransactionReconciliationService {
  /**
   * Attempts to match a newly imported bank transaction with existing
   * manual or scanned expenses to prevent double counting.
   */
  static async reconcileIncomingBankTransaction(
    userId: string,
    bankTransaction: any
  ): Promise<ReconciliationResult> {
    const adminClient = createAdminSupabaseClient();
    
    // 1. Search for pending manual or scanned transactions within a 3-day window
    // that have the exact same amount.
    const txDate = new Date(bankTransaction.date);
    const startDate = new Date(txDate);
    startDate.setDate(txDate.getDate() - 3);
    const endDate = new Date(txDate);
    endDate.setDate(txDate.getDate() + 3);

    const { data: potentialMatches, error } = await adminClient
      .from('financial_transactions')
      .select('*')
      .eq('user_id', userId)
      .in('source', ['manual', 'barcode_scan', 'receipt_scan'])
      .in('reconciliation_status', ['unmatched', 'possible_match'])
      .eq('amount', bankTransaction.amount) // Exact amount match is the strongest signal
      .gte('transaction_date', startDate.toISOString())
      .lte('transaction_date', endDate.toISOString())
      .order('transaction_date', { ascending: false });

    if (error) {
      console.error("[ReconciliationService] Error finding matches:", error);
      return { transactionId: bankTransaction.transactionId, status: 'unmatched' };
    }

    if (!potentialMatches || potentialMatches.length === 0) {
      // No match found, it's a completely new transaction
      return { transactionId: bankTransaction.transactionId, status: 'unmatched' };
    }

    // 2. We have potential matches. For now, we take the closest one by date.
    // In a more advanced system, we'd also run a fuzzy string match on the merchantName.
    const bestMatch = potentialMatches[0];

    // 3. Mark the manual/scanned transaction as merged, linking it to the bank transaction ID.
    // The newly imported bank transaction will be the authoritative one.
    const { error: updateError } = await adminClient
      .from('financial_transactions')
      .update({
        reconciliation_status: 'merged',
        linked_transaction_id: bankTransaction.transactionId, // link to the provider transaction ID
        is_pending: false,
      })
      .eq('id', bestMatch.id);

    if (updateError) {
      console.error("[ReconciliationService] Error updating matched transaction:", updateError);
    }

    return {
      transactionId: bankTransaction.transactionId,
      status: 'matched',
      linkedTransactionId: bestMatch.id
    };
  }

  /**
   * Processes a batch of newly synced bank transactions and inserts them into the unified ledger,
   * running reconciliation on each one.
   */
  static async processBankTransactionBatch(
    userId: string,
    bankAccountId: string,
    transactions: any[]
  ): Promise<void> {
    const adminClient = createAdminSupabaseClient();

    for (const tx of transactions) {
      // 1. Check if we already have this bank transaction (idempotency)
      const { data: existing } = await adminClient
        .from('financial_transactions')
        .select('id')
        .eq('provider_transaction_id', tx.transactionId)
        .maybeSingle();

      if (existing) continue; // Already processed

      // 2. Reconcile against manual/scanned transactions
      const reconciliation = await this.reconcileIncomingBankTransaction(userId, tx);

      // 3. Insert the authoritative bank transaction into the ledger
      await adminClient.from('financial_transactions').insert({
        user_id: userId,
        bank_account_id: bankAccountId,
        provider_transaction_id: tx.transactionId,
        merchant_name: tx.merchantName,
        description: tx.name,
        amount: tx.amount,
        currency: tx.currency,
        transaction_date: new Date(tx.date).toISOString(),
        category: tx.category?.[0] || 'Uncategorized',
        source: 'bank',
        is_pending: tx.pending,
        reconciliation_status: reconciliation.status,
        linked_transaction_id: reconciliation.linkedTransactionId
      });
    }
  }
}
