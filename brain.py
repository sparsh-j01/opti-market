import pandas as pd
import numpy as np
from scipy.optimize import linprog, minimize

def portfolio_expected_return(weights, expected_returns):
    """Calculates the weighted average return of the portfolio."""
    return np.sum(weights * expected_returns)

def portfolio_volatility(weights, volatilities):
    """
    Calculates the portfolio's annualized volatility.
    NOTE: This simplification assumes zero correlation between bond returns.
    A more advanced model would use a covariance matrix.
    """
    return np.sqrt(np.sum((weights * volatilities)**2))

def negative_sharpe_ratio(weights, expected_returns, volatilities, risk_free_rate):
    """
    Calculates the negative Sharpe Ratio for the optimizer to minimize.
    The Sharpe Ratio is the excess return (over the risk-free rate) per unit of volatility.
    """
    p_return = portfolio_expected_return(weights, expected_returns)
    p_volatility = portfolio_volatility(weights, volatilities)
    if p_volatility == 0:
        return np.inf # Avoid division by zero; return infinity if no risk is taken
    sharpe = (p_return - risk_free_rate) / p_volatility
    return -sharpe # We return the negative because the optimizer's goal is to MINIMIZE this value

def run_solver(
    bonds_df, 
    target_duration, 
    capital, 
    max_allocation=0.2, 
    objective_type="Maximize Yield",
    risk_free_rate=0.01,
    max_junk_bond_allocation=0.3, 
    max_sector_allocation=0.25, 
    junk_bond_ratings=None
):
    """
    Solves the optimization problem based on the selected objective and constraints.
    """
    num_bonds = len(bonds_df)
    
    if junk_bond_ratings is None:
        junk_bond_ratings = ["BB", "B", "CCC", "D"]

    # Bounds for individual bond allocations (0% to max_allocation %)
    bounds = [(0.0, max_allocation) for _ in range(num_bonds)]

    # --- OPTIMIZATION PATH 1: Maximize Yield (Linear Programming) ---
    if objective_type == "Maximize Yield":
        # The objective function is to maximize yield, which is equivalent to minimizing the negative yield.
        c = -1 * bonds_df['Yield'].values 

        # Equality Constraints: sum of allocations = 100%, portfolio duration = target duration
        A_eq = np.array([
            np.ones(num_bonds),
            bonds_df['Duration'].values
        ])
        b_eq = np.array([1.0, target_duration])

        # Inequality Constraints (handled by A_ub and b_ub for linprog)
        A_ub_list = []
        b_ub_list = []

        # Constraint 1: Junk bond allocation
        junk_bond_indices = bonds_df['Rating'].isin(junk_bond_ratings).values
        if np.any(junk_bond_indices):
            junk_constraint_row = np.zeros(num_bonds)
            junk_constraint_row[junk_bond_indices] = 1.0
            A_ub_list.append(junk_constraint_row)
            b_ub_list.append(max_junk_bond_allocation)

        # Constraint 2: Sector allocation
        sectors = bonds_df['Sector'].unique()
        for sector in sectors:
            sector_indices = (bonds_df['Sector'] == sector).values
            if np.any(sector_indices):
                sector_constraint_row = np.zeros(num_bonds)
                sector_constraint_row[sector_indices] = 1.0
                A_ub_list.append(sector_constraint_row)
                b_ub_list.append(max_sector_allocation)
        
        A_ub = np.array(A_ub_list) if A_ub_list else None
        b_ub = np.array(b_ub_list) if b_ub_list else None

        # Solve the linear programming problem
        res = linprog(c, A_eq=A_eq, b_eq=b_eq, bounds=bounds, method='highs', A_ub=A_ub, b_ub=b_ub)

        if res.success:
            weights = res.x
        else:
            return None, "Optimization Failed (Linear Solver): " + res.message

    # --- OPTIMIZATION PATH 2: Optimize Sharpe Ratio (Non-Linear Programming) ---
    elif objective_type == "Optimize Sharpe Ratio":
        # Initial guess for weights (equal allocation)
        initial_weights = np.array([1.0 / num_bonds] * num_bonds)
        
        # Constraints for scipy.optimize.minimize (a more flexible format)
        constraints = [
            # Equality constraint: sum of weights must be 1 (100%)
            {'type': 'eq', 'fun': lambda weights: np.sum(weights) - 1},
            # Equality constraint: portfolio duration must equal the target duration
            {'type': 'eq', 'fun': lambda weights: np.sum(weights * bonds_df['Duration'].values) - target_duration}
        ]

        # Inequality constraint: junk bond allocation must be LESS than the max
        junk_bond_indices = bonds_df['Rating'].isin(junk_bond_ratings).values
        if np.any(junk_bond_indices):
            constraints.append({
                'type': 'ineq',
                'fun': lambda weights: max_junk_bond_allocation - np.sum(weights[junk_bond_indices])
            })
        
        # Inequality constraints: each sector's allocation must be LESS than the max
        sectors = bonds_df['Sector'].unique()
        for sector in sectors:
            sector_indices = (bonds_df['Sector'] == sector).values
            if np.any(sector_indices):
                constraints.append({
                    'type': 'ineq',
                    'fun': lambda weights: max_sector_allocation - np.sum(weights[sector_indices])
                })

        # Solve the non-linear optimization problem
        res = minimize(
            negative_sharpe_ratio, 
            initial_weights, 
            args=(bonds_df['Yield'].values, bonds_df['Volatility'].values, risk_free_rate),
            method='SLSQP', # Sequential Least Squares Programming, good for non-linear problems with constraints
            bounds=bounds, 
            constraints=constraints
        )

        if res.success:
            weights = res.x
        else:
            return None, "Optimization Failed (Non-Linear Solver): " + res.message
    else:
        return None, "Invalid objective type selected."

    # --- Process Results ---
    if 'weights' in locals() and weights is not None:
        bonds_df['Allocation %'] = (weights * 100).round(2)
        bonds_df['Investment ($)'] = (weights * capital).round(2)
        
        # Filter out bonds with negligible allocation for a cleaner output
        results_df = bonds_df[bonds_df['Allocation %'] > 0.01].copy()
        
        # Recalculate final portfolio metrics based on the actual bonds chosen
        if not results_df.empty:
            total_allocated_capital = results_df['Investment ($)'].sum()
            actual_weights = results_df['Investment ($)'] / total_allocated_capital if total_allocated_capital > 0 else np.array([])
            
            portfolio_yield = portfolio_expected_return(actual_weights, results_df['Yield'])
            portfolio_duration = portfolio_expected_return(actual_weights, results_df['Duration'])
            portfolio_volatility_val = portfolio_volatility(actual_weights, results_df['Volatility'])
            
            if portfolio_volatility_val > 0:
                sharpe_ratio_val = (portfolio_yield - risk_free_rate) / portfolio_volatility_val
            else:
                sharpe_ratio_val = 0
        else: # Handle case where no bonds are selected
            portfolio_yield, portfolio_duration, portfolio_volatility_val, sharpe_ratio_val = 0, 0, 0, 0

        metrics = {
            "Portfolio Yield": portfolio_yield,
            "Portfolio Duration": portfolio_duration,
            "Portfolio Volatility": portfolio_volatility_val,
            "Sharpe Ratio": sharpe_ratio_val
        }
        
        return results_df, metrics
    else:
        # This case is hit if the optimizer fails and 'weights' is not assigned
        return None, "Optimization failed to produce a valid result."
