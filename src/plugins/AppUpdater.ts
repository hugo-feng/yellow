import { registerPlugin } from '@capacitor/core'

export interface AppUpdaterPlugin {
  downloadAndInstall(options: { url: string; filename?: string }): Promise<{ started?: boolean; success?: boolean; error?: string }>
  getProgress(): Promise<{ status: string; progress: number; downloaded?: number; total?: number }>
}

const AppUpdater = registerPlugin<AppUpdaterPlugin>('AppUpdater')

export default AppUpdater
