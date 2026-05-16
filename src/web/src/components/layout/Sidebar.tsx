import { NavLink } from 'react-router-dom'
import { Layers, Tag, Box, Package2, Scissors, FolderOpen, Sofa } from 'lucide-react'

const NAV_PRODUCT = [
  { to: '/products', icon: Sofa, label: 'Products & BOM' },
]

const NAV_MASTER = [
  { to: '/categories',      icon: Layers,    label: 'Categories' },
  { to: '/types',           icon: Tag,       label: 'Types' },
  { to: '/models',          icon: Box,       label: 'Models' },
  { to: '/material-groups', icon: FolderOpen, label: 'Material Groups' },
  { to: '/materials',       icon: Package2,  label: 'Materials' },
  { to: '/upholster',       icon: Scissors,  label: 'Upholster' },
]

export default function Sidebar() {
  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col shrink-0">
      <div className="px-4 py-5 border-b border-gray-700">
        <p className="font-bold text-white tracking-tight">Sofa Plus+</p>
        <p className="text-xs text-gray-400 mt-0.5">BOM Management</p>
      </div>
      <nav className="flex-1 p-3 overflow-y-auto">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider px-2 mb-2">
          Catalog
        </p>
        {NAV_PRODUCT.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors ${isActive ? 'bg-sky-700 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
            <Icon size={15} strokeWidth={1.8} />{label}
          </NavLink>
        ))}
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider px-2 mt-4 mb-2">
          Master Data
        </p>
        {NAV_MASTER.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors ${isActive ? 'bg-sky-700 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
            <Icon size={15} strokeWidth={1.8} />{label}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-gray-700">
        <p className="text-xs text-gray-500">Sprint 6 · v0.6</p>
      </div>
    </aside>
  )
}
