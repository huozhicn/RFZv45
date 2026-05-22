     1|import type { TenantConfig } from './types'
     2|import guoxueConfig from '../../config/guoxue'
     3|import simiaoConfig from '../../config/simiao'
     4|import rufazaoConfig from '../../config/rufazao'
     5|
     6|const configs: Record<string, TenantConfig> = {
     7|  'guoxue.rufazao.com': guoxueConfig,
     8|  'simiao.rufazao.com': simiaoConfig,
     9|  'admin.rufazao.com': rufazaoConfig,
    10|}
    11|
    12|const hostname = typeof window !== 'undefined' ? window.location.hostname : 'admin.rufazao.com'
    13|const config = configs[hostname] || rufazaoConfig
    14|
    15|export const tenantConfig = config
    16|