export interface TwoFactorStatus {
  enabled: boolean;
  recoveryCodesRemaining: number;
}

export interface TwoFactorSetup {
  /** Base32 secret, for typing into an authenticator app by hand */
  secret: string;
  otpauthUrl: string;
  /** QR code of otpauthUrl as an SVG document */
  qrSvg: string;
}

export interface TwoFactorEnableResult {
  recoveryCodes: string[];
}
