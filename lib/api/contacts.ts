import { supabase } from '../supabase';

// ============================================================================
// CONTACTS
// ============================================================================

export const getContacts = async (userId: string) => {
    const { data, error } = await supabase
        .from('contacts')
        .select(`
            *,
            contact:contact_user_id(
                id,
                full_name,
                avatar_url,
                bio
            )
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
};

export const addContact = async (userId: string, contactUserId: string) => {
    const { error } = await supabase.rpc('add_contact_pure', {
        p_user_id: userId,
        p_contact_id: contactUserId
    });

    if (error) throw error;
    return { user_id: userId, contact_user_id: contactUserId };
};

export const removeContact = async (userId: string, contactUserId: string) => {
    const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('user_id', userId)
        .eq('contact_user_id', contactUserId);

    if (error) throw error;
};

// ============================================================================
// CONTACT REQUESTS
// ============================================================================

export const getContactRequests = async (userId: string) => {
    const { data, error } = await supabase
        .from('contact_requests')
        .select(`
            *,
            from_user:from_user_id(
                id,
                full_name,
                avatar_url
            )
        `)
        .eq('to_user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
};

export const createContactRequest = async (fromUserId: string, toUserId: string) => {
    const { data, error } = await supabase
        .from('contact_requests')
        .insert({
            from_user_id: fromUserId,
            to_user_id: toUserId,
            status: 'pending'
        })
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const acceptContactRequest = async (requestId: string, userId: string, fromUserId: string) => {
    // Update request status
    const { error: updateError } = await supabase
        .from('contact_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId);

    if (updateError) throw updateError;

    // Create bidirectional contacts using the pure RPC
    await Promise.all([
        supabase.rpc('add_contact_pure', { p_user_id: userId, p_contact_id: fromUserId }),
        supabase.rpc('add_contact_pure', { p_user_id: fromUserId, p_contact_id: userId })
    ]);
};

export const declineContactRequest = async (requestId: string) => {
    const { error } = await supabase
        .from('contact_requests')
        .update({ status: 'declined' })
        .eq('id', requestId);

    if (error) throw error;
};

// ============================================================================
// REALTIME SUBSCRIPTIONS
// ============================================================================

export const subscribeToContactRequests = (userId: string, callback: (payload: any) => void) => {
    return supabase
        .channel('contact-requests')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'contact_requests',
                filter: `to_user_id=eq.${userId}`
            },
            callback
        )
        .subscribe();
};
