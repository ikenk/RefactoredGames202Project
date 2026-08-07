import { BASES } from '@/_config/basePaths'
import urlJoin from 'url-join'

const P = BASES.prtSHTxt

// export const PRTDataPaths = {
//   // ========================================
//   // SH
//   // ========================================
//   // ==================== 2 Order Indoor ====================
//   SH_ORDER2_INDOOR_LIGHT: urlJoin(P, 'Indoor/light.txt'),
//   SH_ORDER2_INDOOR_MARY_SHADOWED: urlJoin(P, 'Indoor/transport_mary_shadowed.txt'),
//   SH_ORDER2_INDOOR_MARY_UNSHADOWED: urlJoin(P, 'Indoor/transport_mary_unshadowed.txt'),
//   SH_ORDER2_INDOOR_MARY_INTERREFLECTION: urlJoin(P, 'Indoor/transport_mary_interreflection.txt')
// }

export const PRTDataDirectories = {
  INDOOR: urlJoin(P, 'Indoor/'),
  CORNELL_BOX: urlJoin(P, 'CornellBox/'),
  GRACE_CATHEDRAL: urlJoin(P, 'GraceCathedral/'),
  SKYBOX: urlJoin(P, 'Skybox/')
} as const

export const PRTDataPaths = {
  // ========================================
  // SH
  // ========================================
  // ==================== 2 Order Indoor ====================
  SH_ORDER2_INDOOR_LIGHT: urlJoin(PRTDataDirectories.INDOOR, 'light.txt'),
  SH_ORDER2_INDOOR_MARY_SHADOWED: urlJoin(PRTDataDirectories.INDOOR, 'transport_mary_shadowed.txt'),
  SH_ORDER2_INDOOR_MARY_UNSHADOWED: urlJoin(
    PRTDataDirectories.INDOOR,
    'transport_mary_unshadowed.txt'
  ),
  SH_ORDER2_INDOOR_MARY_INTERREFLECTION: urlJoin(
    PRTDataDirectories.INDOOR,
    'transport_mary_interreflection.txt'
  )
} as const
