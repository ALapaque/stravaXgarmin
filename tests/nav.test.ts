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
    expect(legacyRedirect('/stats', { onglet: 'forme' })).toEqual({ path: '/progression', query: {} })
    expect(legacyRedirect('/stats', { onglet: 'records' })).toEqual({ path: '/progression', query: { onglet: 'records' } })
    expect(legacyRedirect('/stats', { onglet: 'shoes' })).toEqual({ path: '/progression', query: { onglet: 'materiel' } })
    expect(legacyRedirect('/stats', { onglet: 'chaussures' })).toEqual({ path: '/progression', query: { onglet: 'materiel' } })
    expect(legacyRedirect('/stats', { onglet: 'ia' })).toEqual({ path: '/progression', query: { onglet: 'niveau' } })
  })

  it('une rubrique inconnue est oubliée, les autres paramètres sont gardés', () => {
    expect(legacyRedirect('/stats', { onglet: 'zzz', x: '1' })).toEqual({ path: '/progression', query: { x: '1' } })
    expect(legacyRedirect('/plan', { onglet: ['tout'], y: ['2', '3'] })).toEqual({ path: '/journal', query: { y: '2', onglet: 'a-venir' } })
  })

  it('les adresses actuelles ne bougent pas (la page de départ ne redirige jamais)', () => {
    for (const p of ['/', '/journal', '/progression', '/activites/a2', '/reglages', '/recap', '/objectif']) expect(legacyRedirect(p)).toBeNull()
  })
})

describe('retour depuis une course', () => {
  it('revient à l’écran d’où l’on vient, rubrique comprise', () => {
    expect(backTarget('/')).toEqual({ to: '/', label: 'Aujourd’hui' })
    expect(backTarget('/journal?onglet=a-debriefer')).toEqual({ to: '/journal?onglet=a-debriefer', label: 'Journal' })
    expect(backTarget('/progression?onglet=records')).toEqual({ to: '/progression?onglet=records', label: 'Progression' })
    expect(backTarget('/notifications')).toEqual({ to: '/notifications', label: 'Notifications' })
  })

  it('sinon le Journal (arrivée directe, débrief, adresse étrangère)', () => {
    for (const p of [undefined, null, '', '/activites/a2/debrief', 'https://exemple.org/', '//exemple.org', 42]) {
      expect(backTarget(p)).toEqual({ to: '/journal', label: 'Journal' })
    }
  })
})
