import streamlit as st
import pandas as pd
import altair as alt
import data_loader
import brain

# --- PAGE CONFIG ---
st.set_page_config(page_title="OptiMarket Agent", layout="wide")

def run_app():
    """The main application logic."""
    st.sidebar.title("⚡ OptiMarket Pro")
    st.sidebar.markdown("### Advanced Bond Portfolio Optimization")

    # --- Sidebar Inputs ---
    with st.sidebar:
        st.header("1. Optimization Goal")
        objective_type = st.radio(
            "Select Objective",
            ("Maximize Yield", "Optimize Sharpe Ratio"),
            help="Maximize Yield aims for the highest return for a given duration. Optimize Sharpe Ratio balances return against risk."
        )

        st.header("2. Investor Constraints")
        capital = st.number_input("Capital ($)", value=100000, step=1000)
        target_duration = st.slider("Target Duration (Years)", 2.0, 10.0, 5.0)
        max_allocation = st.slider("Max Allocation per Bond (%)", 5, 50, 20) / 100.0

        if objective_type == "Optimize Sharpe Ratio":
            risk_free_rate = st.number_input(
                "Risk-Free Rate (e.g., 0.01 for 1%)", 
                value=0.01, format="%.4f",
                help="Typically the yield on a short-term government bond."
            )
        else:
            risk_free_rate = 0.01 # Default, not used for Maximize Yield

        st.subheader("Credit Quality Constraints")
        all_ratings = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC", "D"]
        junk_bond_ratings_default = ["BB", "B", "CCC", "D"]
        junk_bond_ratings = st.multiselect(
            "Define 'Junk' Bond Ratings",
            options=all_ratings,
            default=junk_bond_ratings_default,
            help="Select bond ratings considered 'junk' or higher risk."
        )
        max_junk_bond_allocation = st.slider(
            "Max Allocation to 'Junk' Bonds (%)", 
            0, 100, 30, step=5
        ) / 100.0
        
        st.subheader("Diversification Constraints")
        max_sector_allocation = st.slider(
            "Max Allocation per Sector (%)", 
            0, 100, 25, step=5
        ) / 100.0


        st.info(f"""
            **Goal:** {objective_type} while keeping portfolio duration at **{target_duration:.1f}** years.
            No more than **{max_allocation*100:.0f}%** in any single bond.
            No more than **{max_junk_bond_allocation*100:.0f}%** in selected 'Junk' bonds ({', '.join(junk_bond_ratings)}).
            No more than **{max_sector_allocation*100:.0f}%** in any single sector.
        """)
        
        if st.button("Clear Cache & Refetch Data"):
            st.cache_data.clear()
            st.rerun()

    # --- Data Loading ---
    with st.spinner("Generating bond market data..."):
        market_df = data_loader.generate_bond_market()

    st.subheader("Available Market Bonds")
    with st.expander(f"View {len(market_df)} Bonds", expanded=False):
        st.dataframe(market_df[['Bond_ID', 'Company', 'Sector', 'Rating', 'Yield', 'Duration', 'Volatility']], width='stretch') # Changed from hide_index=True for now, so columns can be copied easily
        st.caption("This is a synthetic market. For real-world data, replace `data_loader.py` with your Bloomberg data reader.")

    st.subheader("Optimization Engine")
    if st.button("RUN OPTIMIZER", type="primary"):
        with st.spinner("Running optimization... This might take a moment."):
            results_df, metrics = brain.run_solver(
                bonds_df=market_df.copy(), # Pass a copy to avoid modifying original df
                target_duration=target_duration,
                capital=capital,
                max_allocation=max_allocation,
                objective_type=objective_type,
                risk_free_rate=risk_free_rate,
                max_junk_bond_allocation=max_junk_bond_allocation,
                max_sector_allocation=max_sector_allocation,
                junk_bond_ratings=junk_bond_ratings
            )
        
        if results_df is not None:
            st.success("Optimization successful!")
            
            tab1, tab2, tab3 = st.tabs(["Portfolio Overview", "Trade Sheet", "Analytics"])

            with tab1:
                st.markdown("#### Optimized Portfolio Summary")
                if objective_type == "Optimize Sharpe Ratio":
                    st.info("Note: Portfolio Volatility and Sharpe Ratio are calculated assuming zero correlation between bond returns.")
                
                # Display Big Metrics
                col1, col2, col3, col4 = st.columns(4)
                col1.metric("Portfolio Yield", f"{metrics['Portfolio Yield']:.2%}")
                col2.metric("Portfolio Duration", f"{metrics['Portfolio Duration']:.2f} Years")
                col3.metric("Portfolio Volatility", f"{metrics['Portfolio Volatility']:.2%}")
                col4.metric("Sharpe Ratio", f"{metrics['Sharpe Ratio']:.2f}")

                st.markdown("---")
                st.markdown("##### Portfolio Allocation Overview")
                
                # Allocation by Rating Chart
                rating_allocation = results_df.groupby('Rating')['Allocation %'].sum().reset_index()
                rating_chart = alt.Chart(rating_allocation).mark_arc().encode(
                    theta=alt.Theta(field="Allocation %", type="quantitative"),
                    color=alt.Color(field="Rating", type="nominal", sort=all_ratings, title="Rating")
                ).properties(title="Allocation by Rating", height=300)
                st.altair_chart(rating_chart, width='stretch')

                # Allocation by Sector Chart
                sector_allocation = results_df.groupby('Sector')['Allocation %'].sum().reset_index()
                sector_chart = alt.Chart(sector_allocation).mark_arc().encode(
                    theta=alt.Theta(field="Allocation %", type="quantitative"),
                    color=alt.Color(field="Sector", type="nominal", title="Sector")
                ).properties(title="Allocation by Sector", height=300)
                st.altair_chart(sector_chart, width='stretch')

            with tab2:
                st.markdown("#### Trade Sheet")
                st.dataframe(results_df[['Bond_ID', 'Company', 'Sector', 'Rating', 'Yield', 'Duration', 'Volatility', 'Allocation %', 'Investment ($)']], width='stretch')

            with tab3:
                st.markdown("#### Analytics & Charts")
                
                # Allocation by Company Chart
                company_allocation = results_df.groupby('Company')['Allocation %'].sum().reset_index()
                company_chart = alt.Chart(company_allocation).mark_arc().encode(
                    theta=alt.Theta(field="Allocation %", type="quantitative"),
                    color=alt.Color(field="Company", type="nominal", title="Company")
                ).properties(title="Allocation by Company", height=300)
                st.altair_chart(company_chart, width='stretch')

        else:
            st.error(f"Optimization Failed: {metrics}. Please adjust your constraints or market data.")

    else:
        st.info("Click 'RUN OPTIMIZER' to generate your bond portfolio.")

if __name__ == "__main__":
    run_app()