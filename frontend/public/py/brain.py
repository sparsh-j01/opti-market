import pandas as pd
import numpy as np
from scipy.optimize import linprog, minimize
import data_loader

def portfolio_expected_return(weights, expected_returns):
    """Calculates the weighted average return of the portfolio."""
    return np.sum(weights * expected_returns)

def portfolio_volatility(weights, cov_matrix):
    """
    Calculates portfolio volatility using Covariance Matrix.
    Formula: sqrt( w^T * Cov * w )
    """
    variance = weights.T @ cov_matrix @ weights
    return np.sqrt(max(variance, 0.0))

def negative_sharpe_ratio(weights, expected_returns, cov_matrix, risk_free_rate):
    """
    Negative Sharpe Ratio for minimization.
    """
    p_return = portfolio_expected_return(weights, expected_returns)
    p_volatility = portfolio_volatility(weights, cov_matrix)
    if p_volatility == 0:
        return np.inf
    sharpe = (p_return - risk_free_rate) / p_volatility
    return -sharpe

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

    cov_matrix = data_loader.generate_covariance_matrix(bonds_df)
    bounds = [(0.0, max_allocation) for _ in range(num_bonds)]

    if objective_type == "Maximize Yield":
        c = -1 * bonds_df['Yield'].values 

        A_eq = np.array([
            np.ones(num_bonds),
            bonds_df['Duration'].values
        ])
        b_eq = np.array([1.0, target_duration])

        A_ub_list = []
        b_ub_list = []

        junk_bond_indices = bonds_df['Rating'].isin(junk_bond_ratings).values
        if np.any(junk_bond_indices):
            junk_constraint_row = np.zeros(num_bonds)
            junk_constraint_row[junk_bond_indices] = 1.0
            A_ub_list.append(junk_constraint_row)
            b_ub_list.append(max_junk_bond_allocation)

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

        res = linprog(c, A_eq=A_eq, b_eq=b_eq, bounds=bounds, method='highs', A_ub=A_ub, b_ub=b_ub)

        if res.success:
            weights = res.x
        else:
            return None, "Optimization Failed (Linear Solver): " + res.message

    elif objective_type == "Optimize Sharpe Ratio":
        initial_weights = np.array([1.0 / num_bonds] * num_bonds)
        
        constraints = [
            {'type': 'eq', 'fun': lambda weights: np.sum(weights) - 1},
            {'type': 'eq', 'fun': lambda weights: np.sum(weights * bonds_df['Duration'].values) - target_duration}
        ]

        junk_bond_indices = bonds_df['Rating'].isin(junk_bond_ratings).values
        if np.any(junk_bond_indices):
            constraints.append({
                'type': 'ineq',
                'fun': lambda weights, idx=junk_bond_indices: max_junk_bond_allocation - np.sum(weights[idx])
            })
        
        sectors = bonds_df['Sector'].unique()
        for sector in sectors:
            sector_indices = (bonds_df['Sector'] == sector).values
            if np.any(sector_indices):
                constraints.append({
                    'type': 'ineq',
                    'fun': lambda weights, idx=sector_indices: max_sector_allocation - np.sum(weights[idx])
                })

        res = minimize(
            negative_sharpe_ratio, 
            initial_weights, 
            args=(bonds_df['Yield'].values, cov_matrix, risk_free_rate),
            method='SLSQP',
            bounds=bounds, 
            constraints=constraints
        )

        if res.success:
            weights = res.x
        else:
            return None, "Optimization Failed (Non-Linear Solver): " + res.message
    else:
        return None, "Invalid objective type selected."

    if 'weights' in locals() and weights is not None:
        bonds_df = bonds_df.copy()
        bonds_df['Allocation %'] = (weights * 100).round(2)
        bonds_df['Investment ($)'] = (weights * capital).round(2)
        
        results_df = bonds_df[bonds_df['Allocation %'] > 0.01].copy()
        
        if not results_df.empty:
            total_allocated_capital = results_df['Investment ($)'].sum()
            actual_weights = results_df['Investment ($)'] / total_allocated_capital if total_allocated_capital > 0 else np.array([])
            
            selected_cov_matrix = data_loader.generate_covariance_matrix(results_df)

            portfolio_yield = portfolio_expected_return(actual_weights, results_df['Yield'])
            portfolio_duration = portfolio_expected_return(actual_weights, results_df['Duration'])
            portfolio_volatility_val = portfolio_volatility(actual_weights, selected_cov_matrix)
            
            if portfolio_volatility_val > 0:
                sharpe_ratio_val = (portfolio_yield - risk_free_rate) / portfolio_volatility_val
            else:
                sharpe_ratio_val = 0
        else:
            portfolio_yield, portfolio_duration, portfolio_volatility_val, sharpe_ratio_val = 0, 0, 0, 0

        metrics = {
            "Portfolio Yield": float(portfolio_yield),
            "Portfolio Duration": float(portfolio_duration),
            "Portfolio Volatility": float(portfolio_volatility_val),
            "Sharpe Ratio": float(sharpe_ratio_val)
        }
        
        return results_df, metrics
    else:
        return None, "Optimization failed to produce a valid result."

def generate_efficient_frontier(bonds_df, capital, max_alloc, max_junk, max_sector, junk_ratings, risk_free_rate):
    """
    Sweeps through target durations to find optimal portfolios forming the Efficient Frontier.
    """
    frontier = []
    durations_to_test = np.linspace(2.0, 10.0, 10)
    
    for d in durations_to_test:
        df, metrics = run_solver(
            bonds_df.copy(), 
            target_duration=d, 
            capital=capital, 
            max_allocation=max_alloc, 
            objective_type="Optimize Sharpe Ratio", 
            risk_free_rate=risk_free_rate,
            max_junk_bond_allocation=max_junk, 
            max_sector_allocation=max_sector, 
            junk_bond_ratings=junk_ratings
        )
        if isinstance(metrics, dict) and metrics.get('Portfolio Yield', 0) > 0:
            frontier.append({
                'Target Duration': float(d),
                'Yield': metrics['Portfolio Yield'],
                'Volatility': metrics['Portfolio Volatility'],
                'Sharpe Ratio': metrics['Sharpe Ratio']
            })
            
    return frontier
