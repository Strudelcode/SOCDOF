import React from 'react';
import { Contact } from '../../types';

export type Client = {
  id: string;
  name: string;
  birthDate: string;
  contact: string;
  notes: string;
  createdAt: string;
  contactId?: number | string;
  email?: string;
  phone?: string;
  company?: string;
  address?: string;
  city?: string;
  zip?: string;
  diagnosis?: string;
  insuranceType?: 'self' | 'statutory' | 'private' | string;
  hourlyRate?: number;
};

export type Session = {
  id: string;
  clientId: string;
  date: string;
  startTime?: string;
  endTime?: string;
  duration: number;
  template?: string;
  intervention: string;
  progress: string;
  fee?: number;
};

export type Appointment = {
  id: string;
  clientId: string;
  date: string;
  time?: string;
  status: 'scheduled' | 'attended' | 'cancelled' | 'missed';
  notes: string;
};

export type Trip = {
  id: string;
  clientId?: string;
  date: string;
  departure: string;
  destination: string;
  purpose: string;
  startKm: number;
  endKm: number;
  rate: number;
};

export type BillingItem = {
  id: string;
  clientId: string;
  date: string;
  service: string;
  amount: number;
  taxRate?: number;
  status: 'draft' | 'ready' | 'invoiced' | 'paid';
  invoiceNumber?: string;
  dueDate?: string;
  notes?: string;
};

export type PracticeData = {
  clients: Client[];
  sessions: Session[];
  appointments: Appointment[];
  trips: Trip[];
  billing: BillingItem[];
};
