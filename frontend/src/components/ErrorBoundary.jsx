import { Component } from 'react'

/** Attrape les erreurs de rendu React — évite l'écran blanc total. */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg text-text-main flex flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="text-5xl">😵</div>
          <div className="font-title font-extrabold text-xl">Oups, quelque chose a cassé</div>
          <div className="text-muted text-sm max-w-md">
            Une erreur inattendue est survenue. Recharge la page — si le problème persiste,
            vide le cache ou reconnecte-toi.
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-5 py-2.5 rounded-field bg-violet text-white font-semibold cursor-pointer border-none"
          >
            Recharger la page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
