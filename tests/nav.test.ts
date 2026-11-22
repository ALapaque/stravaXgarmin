import { describe, expect, it } from 'vitest'
import { backTarget, legacyRedirect } from '../shared/utils/nav'

describe('anciennes adresses', () => {
  it('Activités et Plan mènent au Journal', () => {
    expect(legacyRedirect('/activites')).toEqual({ path: '/journal', query: {} })
    expect(legacyRedirect('/activites/')).toEqual({ path: '/journal', query: {} })
    expect(legacyRedirect('/plan')).toEqual({ path: '/journal', query: { onglet: 'a-venir' } })
  })

  it('Stats mène à Progression, avec la rubrique correspondante', () => {
    expect(legacyRedirect('/stats')).toEqual({ path: '/progression', query: {} })
    // Régularité est la rubrique par défaut : Forme s'écrit dans l'adresse
    expect(legacyRedirect('/stats', { onglet: 'forme' })).toEqual({ path: '/progression', query: { onglet: 'forme' } })
    expect(legacyRedirect('/stats', { onglet: 'records' })).toEqual({ path: '/progression', query: { onglet: 'records' } })
    expect(legacyRedirect('/stats', { onglet: 'shoes' })).toEqual({ path: '/progression', query: { onglet: 'materiel' } })
    expect(legacyRedirect('/stats', { onglet: 'chaussures' })).toEqual({ path: '/progression', query: { onglet: 'materiel' } })
    // L'estimation par l'IA est maintenant un repli de Forme
    expect(legacyRedirect('/stats', { onglet: 'ia' })).toEqual({ path: '/progression', query: { onglet: 'forme' } })
    expect(legacyRedirect('/stats', { onglet: 'niveau' })).toEqual({ path: '/progression', query: { onglet: 'forme' } })
  })

  it('l’ancienne rubrique « Niveau IA » de Progression mène à Forme', () => {
    expect(legacyRedirect('/progression', { onglet: 'niveau' })).toEqual({ path: '/progression', query: { onglet: 'forme' } })
    expect(legacyRedirect('/progression', { onglet: 'records' })).toBeNull()
  })

  it('Récap mène au Bilan, la période gardée', () => {
    expect(legacyRedirect('/recap')).toEqual({ path: '/bilan', query: {} })
    expect(legacyRedirect('/recap', { p: 'mois' })).toEqual({ path: '/bilan', query: { p: 'mois' } })
  })

  it('les rubriques de l’ancienne page des réglages mènent à leur sous-page', () => {
    expect(legacyRedirect('/reglages', { onglet: 'comptes' })).toEqual({ path: '/reglages/comptes', query: {} })
    expect(legacyRedirect('/reglages', { onglet: 'synchro' })).toEqual({ path: '/reglages/synchro', query: {} })
    expect(legacyRedirect('/reglages', { onglet: 'notifs' })).toEqual({ path: '/reglages/notifications', query: {} })
    expect(legacyRedirect('/reglages', { onglet: 'style' })).toEqual({ path: '/reglages/apparence', query: {} })
    expect(legacyRedirect('/reglages/', { onglet: ['style'], x: '1' })).toEqual({ path: '/reglages/apparence', query: { x: '1' } })
    // Rubrique inconnue : la page d'accueil des réglages, sans la rubrique (pas de boucle)
    expect(legacyRedirect('/reglages', { onglet: 'zzz' })).toEqual({ path: '/reglages', query: {} })
    expect(legacyRedirect('/reglages')).toBeNull()
  })

  it('une rubrique inconnue est oubliée, les autres paramètres sont gardés', () => {
    expect(legacyRedirect('/stats', { onglet: 'zzz', x: '1' })).toEqual({ path: '/progression', query: { x: '1' } })
    expect(legacyRedirect('/plan', { onglet: ['tout'], y: ['2', '3'] })).toEqual({ path: '/journal', query: { y: '2', onglet: 'a-venir' } })
  })

  it('les adresses actuelles ne bougent pas (la page de départ ne redirige jamais)', () => {
    for (const p of ['/', '/journal', '/progression', '/activites/a2', '/reglages', '/reglages/coureur', '/bilan', '/objectif']) expect(legacyRedirect(p)).toBeNull()
  })
})

describe('retour depuis une course', () => {
  it('revient à l’écran d’où l’on vient, rubrique comprise', () => {
    expect(backTarget('/')).toEqual({ to: '/', label: 'Aujourd’hui' })
    expect(backTarget('/journal?onglet=a-debriefer')).toEqual({ to: '/journal?onglet=a-debriefer', label: 'Journal' })
    expect(backTarget('/progression?onglet=records')).toEqual({ to: '/progression?onglet=records', label: 'Progression' })
    expect(backTarget('/notifications')).toEqual({ to: '/notifications', label: 'Notifications' })
    expect(backTarget('/bilan?semaine=2026-11-09')).toEqual({ to: '/bilan?semaine=2026-11-09', label: 'Progression' })
  })

  it('sinon le Journal (arrivée directe, débrief, adresse étrangère)', () => {
    for (const p of [undefined, null, '', '/activites/a2/debrief', 'https://exemple.org/', '//exemple.org', 42]) {
      expect(backTarget(p)).toEqual({ to: '/journal', label: 'Journal' })
    }
  })
})
