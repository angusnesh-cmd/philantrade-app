import { supabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerAddress = searchParams.get('owner');
    const activeOnly = searchParams.get('active') !== 'false';
    
    let query = supabaseAdmin
      .from('distributors')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (ownerAddress) {
      query = query.eq('owner_address', ownerAddress.toLowerCase());
    }
    
    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return NextResponse.json({ distributors: data });
    
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
