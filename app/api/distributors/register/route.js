import { supabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { contract_address, owner_address, owner_name, owner_email } = body;
    
    // Валидация
    if (!contract_address || !owner_address) {
      return NextResponse.json(
        { error: 'contract_address and owner_address are required' },
        { status: 400 }
      );
    }
    
    // Нормализуем адреса (нижний регистр)
    const normalizedContract = contract_address.toLowerCase();
    const normalizedOwner = owner_address.toLowerCase();
    
    // Проверяем, не зарегистрирован ли уже контракт
    const { data: existing } = await supabaseAdmin
      .from('distributors')
      .select('id')
      .eq('contract_address', normalizedContract)
      .maybeSingle();
    
    if (existing) {
      return NextResponse.json(
        { error: 'Contract already registered' },
        { status: 409 }
      );
    }
    
    // Регистрируем
    const { data, error } = await supabaseAdmin
      .from('distributors')
      .insert({
        contract_address: normalizedContract,
        owner_address: normalizedOwner,
        owner_name: owner_name || null,
        owner_email: owner_email || null,
        is_active: true
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json({
      success: true,
      distributor: data,
      message: 'Distributor registered successfully'
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
