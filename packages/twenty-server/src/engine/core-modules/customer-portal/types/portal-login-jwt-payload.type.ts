import { type CommonPropertiesJwtPayload } from 'src/engine/core-modules/auth/types/common-properties-jwt-payload.type';
import { JwtTokenTypeEnum } from 'src/engine/core-modules/auth/types/jwt-token-type.enum';

export type PortalLoginJwtPayload = CommonPropertiesJwtPayload & {
  type: JwtTokenTypeEnum.PORTAL_LOGIN;
  portalAccessId: string;
  personId: string;
  workspaceId: string;
};
