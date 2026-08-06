import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export default function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  const routeMap: Record<string, string> = {
    dashboard: 'Dashboard Overview',
    catalog: 'Showcase Catalog',
    stones: 'Loose Stones Vault',
    billing: 'Sales Billing Estimator',
    karigar: 'Artisan Jobwork Ledger',
    jobbags: 'Job Bags Tracker',
    customers: 'Customer Accounts & Schemes',
    oldgold: 'Old Gold Buyback Vault',
    // Routes added after the original map; without these the crumb showed the raw path
    // segment, so /inventory read as "INVENTORY" beside properly named siblings.
    inventory: 'Inventory Operations',
    repairs: 'Repairs & Service',
    purchases: 'Procurement & Suppliers',
    accounting: 'Accounting & Ledgers',
    reports: 'Reports & Analytics',
    roles: 'Administration',
  };

  return (
    <nav className="flex items-center space-x-1.5 text-[10px] font-mono uppercase tracking-wider text-[#71717A] select-none min-w-0 whitespace-nowrap">
      {/* Icon only — the wordmark already sits in the sidebar, so repeating it here spent
          navbar width on something the user has just read. Labelled for screen readers,
          which can no longer infer the destination from visible text. */}
      <Link
        to="/dashboard"
        aria-label="Dashboard home"
        title="Dashboard home"
        className="flex items-center hover:text-white transition duration-150"
      >
        <Home className="w-3.5 h-3.5 text-[#C5A059]" />
      </Link>

      {pathnames.length > 0 && <ChevronRight className="w-3 h-3 text-[#262626] shrink-0" />}

      {pathnames.map((name, index) => {
        const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;
        const displayName = routeMap[name] || name;

        return (
          <React.Fragment key={name}>
            {index > 0 && <ChevronRight className="w-3 h-3 text-[#262626] shrink-0" />}
            {isLast ? (
              <span className="text-white font-bold truncate">{displayName}</span>
            ) : (
              <Link to={routeTo} className="hover:text-white transition duration-150">
                {displayName}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
