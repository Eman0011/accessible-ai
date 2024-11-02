import { AuthUser } from 'aws-amplify/auth';
import { UserInfo } from '../types/models';

export function createUserInfo(authUser: AuthUser): UserInfo {
    console.log("Auth User: ", authUser)
    return {
        userId: authUser.userId,
        username: authUser.signInDetails?.loginId?.split('@')[0] || 'unknown_user',
        email: authUser.signInDetails?.loginId || 'unknown_email',
        organizationId: 'default', // This would need to come from our database
        role: 'member' // This would need to come from our database
    };
}