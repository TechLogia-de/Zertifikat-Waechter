import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { DomainRegistration, AlertEvent } from '../types/index.js';

const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

export class SupabaseService {
  
  async registerDomain(
    tenantId: string, 
    name: string, 
    port: number = 443, 
    tags: string[] = []
  ): Promise<DomainRegistration> {
    // Asset erstellen oder aktualisieren
    const { data: existingAsset } = await supabase
      .from('assets')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('host', name)
      .eq('port', port)
      .single();
    
    if (existingAsset) {
      // Tags aktualisieren
      const updatedLabels = {
        ...(existingAsset.labels || {}),
        tags: [...new Set([...(existingAsset.labels?.tags || []), ...tags])],
      };
      
      await supabase
        .from('assets')
        .update({ labels: updatedLabels })
        .eq('id', existingAsset.id);
      
      return {
        id: existingAsset.id,
        name: existingAsset.host,
        port: existingAsset.port,
        tags: updatedLabels.tags,
        status: 'active',
        lastScanned: existingAsset.last_scanned_at,
      };
    }
    
    // Neues Asset erstellen
    const { data: newAsset, error } = await supabase
      .from('assets')
      .insert({
        tenant_id: tenantId,
        host: name,
        port,
        proto: 'https',
        labels: { tags },
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Domain-Registrierung fehlgeschlagen: ${error.message}`);
    }
    
    return {
      id: newAsset.id,
      name: newAsset.host,
      port: newAsset.port,
      tags: newAsset.labels?.tags || [],
      status: 'active',
    };
  }
  
  async listDomains(
    tenantId: string, 
    filter: 'all' | 'expiring' | 'expired' | 'valid' = 'all',
    limit: number = 100
  ): Promise<DomainRegistration[]> {
    let query = supabase
      .from('assets')
      .select(`
        id,
        host,
        port,
        labels,
        last_scanned_at,
        certificates (
          id,
          not_after,
          is_trusted
        )
      `)
      .eq('tenant_id', tenantId)
      .limit(limit);
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Domain-Liste konnte nicht geladen werden: ${error.message}`);
    }
    
    const domains: DomainRegistration[] = (data || []).map((asset: any) => {
      const cert = asset.certificates?.[0];
      const now = Date.now();
      const expiresAt = cert ? new Date(cert.not_after).getTime() : null;
      const daysLeft = expiresAt ? Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)) : null;
      
      let status: 'active' | 'paused' | 'error' = 'active';
      if (!cert) status = 'error';
      else if (daysLeft !== null && daysLeft < 0) status = 'error';
      
      return {
        id: asset.id,
        name: asset.host,
        port: asset.port,
        tags: asset.labels?.tags || [],
        status,
        lastScanned: asset.last_scanned_at,
      };
    });
    
    // Filter anwenden
    if (filter !== 'all') {
      return domains.filter(domain => {
        // Hier könnte man basierend auf dem Filter filtern
        return true;
      });
    }
    
    return domains;
  }
  
  async saveScanResult(
    tenantId: string,
    host: string,
    port: number,
    certificate: any,
    chain: any
  ): Promise<void> {
    // Asset finden oder erstellen
    const { data: asset } = await supabase
      .from('assets')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('host', host)
      .eq('port', port)
      .single();
    
    const assetId = asset?.id || (await this.createAsset(tenantId, host, port));
    
    // Zertifikat speichern
    const { error } = await supabase
      .from('certificates')
      .upsert({
        asset_id: assetId,
        fingerprint: certificate.fingerprint256,
        subject_cn: certificate.subject.CN,
        san: certificate.subjectAltNames || [],
        issuer: certificate.issuer.CN,
        not_before: new Date(certificate.validFrom).toISOString(),
        not_after: new Date(certificate.validTo).toISOString(),
        key_alg: 'RSA', // Würde aus Zertifikat extrahiert
        serial: certificate.serialNumber,
        is_trusted: true,
      }, {
        onConflict: 'fingerprint',
      });
    
    if (error) {
      console.error('Fehler beim Speichern des Zertifikats:', error);
    }
  }
  
  private async createAsset(tenantId: string, host: string, port: number): Promise<string> {
    const { data, error } = await supabase
      .from('assets')
      .insert({
        tenant_id: tenantId,
        host,
        port,
        proto: 'https',
        labels: {},
      })
      .select('id')
      .single();
    
    if (error || !data) {
      throw new Error('Asset konnte nicht erstellt werden');
    }
    
    return data.id;
  }
  
  async logEvent(
    tenantId: string,
    type: string,
    payload: Record<string, any>
  ): Promise<void> {
    await supabase
      .from('events')
      .insert({
        tenant_id: tenantId,
        type,
        payload,
        ts: new Date().toISOString(),
      });
  }
  
  async getRecentAlerts(
    tenantId: string,
    limit: number = 50
  ): Promise<AlertEvent[]> {
    const { data, error } = await supabase
      .from('alerts')
      .select(`
        id,
        level,
        first_triggered_at,
        last_notified_at,
        acknowledged_by,
        certificate:certificates (
          asset:assets (
            host,
            port
          ),
          not_after
        )
      `)
      .eq('tenant_id', tenantId)
      .order('first_triggered_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      throw new Error('Alerts konnten nicht geladen werden');
    }
    
    return (data || []).map((alert: any) => ({
      id: alert.id,
      type: 'CERT_EXPIRES_SOON' as const,
      severity: alert.level,
      host: alert.certificate?.asset?.host || 'unknown',
      message: `Zertifikat läuft bald ab`,
      timestamp: alert.first_triggered_at,
      metadata: {
        expiresAt: alert.certificate?.not_after,
        acknowledged: !!alert.acknowledged_by,
      },
    }));
  }
}

