import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import CategoriesPage from './pages/master-data/CategoriesPage'
import TypesPage from './pages/master-data/TypesPage'
import ModelsPage from './pages/master-data/ModelsPage'
import MaterialGroupsPage from './pages/master-data/MaterialGroupsPage'
import MaterialsPage from './pages/master-data/MaterialsPage'
import UpholsterPage from './pages/master-data/UpholsterPage'
import ProductsPage from './pages/products/ProductsPage'
import BomBuilderPage from './pages/products/BomBuilderPage'
import VariantsPage from './pages/products/VariantsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/products" replace />} />
          <Route path="products"        element={<ProductsPage />} />
          <Route path="products/:id/bom"      element={<BomBuilderPage />} />
          <Route path="products/:id/variants" element={<VariantsPage />} />
          <Route path="categories"      element={<CategoriesPage />} />
          <Route path="types"           element={<TypesPage />} />
          <Route path="models"          element={<ModelsPage />} />
          <Route path="material-groups" element={<MaterialGroupsPage />} />
          <Route path="materials"       element={<MaterialsPage />} />
          <Route path="upholster"       element={<UpholsterPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
