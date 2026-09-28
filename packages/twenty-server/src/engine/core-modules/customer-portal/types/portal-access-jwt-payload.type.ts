import { type CommonPropertiesJwtPayload } from 'src/engine/core-modules/auth/types/common-properties-jwt-payload.type';
import { JwtTokenTypeEnum } from 'src/engine/core-modules/auth/types/jwt-token-type.enum';

export type PortalAccessJwtPayload = CommonPropertiesJwtPayload & {
  type: JwtTokenTypeEnum.PORTAL_ACCESS;
  portalAccessId: string;
  personId: string;
  workspaceId: string;
};
