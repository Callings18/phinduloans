import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private client: SupabaseClient | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url = this.config.get<string>("SUPABASE_URL") ?? this.config.get<string>("VITE_SUPABASE_URL");
    const key =
      this.config.get<string>("SUPABASE_SERVICE_ROLE_KEY") ??
      this.config.get<string>("SUPABASE_ANON_KEY") ??
      this.config.get<string>("SUPABASE_PUBLISHABLE_KEY");

    if (!url || !key) {
      this.logger.warn(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or ANON key) are not set; bearer auth will fail.",
      );
      return;
    }

    this.client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  getClient(): SupabaseClient | null {
    return this.client;
  }
}
