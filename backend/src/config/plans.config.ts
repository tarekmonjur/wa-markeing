import { Plan } from '../database/enums';

export interface PlanConfig {
  maxContacts: number;
  maxSessions: number;
  maxCampaignsPerMonth: number;
  maxMessagesPerDay: number;
  maxTeamMembers: number;
  aiGenerationsPerDay: number;
  canUseWebhooks: boolean;
  canUseApi: boolean;
  canUseAutoReply: boolean;
  canUseDrip: boolean;
}

export const PLANS: Record<Plan, PlanConfig> = {
  [Plan.FREE]: {
    maxContacts: 500,
    maxSessions: 1,
    maxCampaignsPerMonth: 5,
    maxMessagesPerDay: 100,
    maxTeamMembers: 1,
    aiGenerationsPerDay: 5,
    canUseWebhooks: false,
    canUseApi: false,
    canUseAutoReply: false,
    canUseDrip: false,
  },
  [Plan.STARTER]: {
    maxContacts: 5_000,
    maxSessions: 2,
    maxCampaignsPerMonth: 30,
    maxMessagesPerDay: 500,
    maxTeamMembers: 3,
    aiGenerationsPerDay: 30,
    canUseWebhooks: true,
    canUseApi: false,
    canUseAutoReply: true,
    canUseDrip: true,
  },
  [Plan.PRO]: {
    maxContacts: 50_000,
    maxSessions: 10,
    maxCampaignsPerMonth: -1,
    maxMessagesPerDay: 2_000,
    maxTeamMembers: 10,
    aiGenerationsPerDay: 200,
    canUseWebhooks: true,
    canUseApi: true,
    canUseAutoReply: true,
    canUseDrip: true,
  },
  [Plan.AGENCY]: {
    maxContacts: -1,
    maxSessions: -1,
    maxCampaignsPerMonth: -1,
    maxMessagesPerDay: -1,
    maxTeamMembers: -1,
    aiGenerationsPerDay: -1,
    canUseWebhooks: true,
    canUseApi: true,
    canUseAutoReply: true,
    canUseDrip: true,
  },
};
