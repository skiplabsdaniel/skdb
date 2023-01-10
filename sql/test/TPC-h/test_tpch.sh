#!/bin/bash

SKDB=/skfs_build/build/skdb

rm -f /tmp/nation_count

###############################################################################
# BUILD DB
###############################################################################

START=$SECONDS
./makeSqliveDb.sh
TOTAL=$(($SECONDS - $START))
if (( TOTAL > 180 ));
then
    echo -e "BUILD TPC-H:\tFAILED ($TOTAL)"
else
    echo -e "BUILD TPC-H:\tOK ($TOTAL)"
fi

###############################################################################
# NATION_COUNT VIEW
###############################################################################

echo "create virtual view nation_count as select c_nationkey, count(*) from customer group by c_nationkey;" | $SKDB --data /tmp/test.db
$SKDB --data /tmp/test.db --connect nation_count --updates /tmp/nation_count > /dev/null

###############################################################################
# JOIN VIEW
###############################################################################

START=$SECONDS
cat view1.sql | $SKDB --data /tmp/test.db
TOTAL=$(($SECONDS - $START))
if (( TOTAL > 120 ));
then
    echo -e "BUILD VIEW1:\tFAILED ($TOTAL)"
else
    echo -e "BUILD VIEW1:\tOK ($TOTAL)"
fi

###############################################################################
# INDEX
###############################################################################

START=$SECONDS
echo "create index view1_o_orderdate on view1(o_orderdate);" | $SKDB --data /tmp/test.db
TOTAL=$(($SECONDS - $START))
if (( TOTAL > 10 ));
then
    echo -e "BUILD INDEX view1_o_orderdate:\tFAILED ($TOTAL)"
else
    echo -e "BUILD INDEX view1_o_orderdate:\tOK ($TOTAL)"
fi

###############################################################################
# Query 1
###############################################################################

rm -f /tmp/query1

START=$SECONDS
cat query1.sql | $SKDB --data /tmp/test.db
TOTAL=$(($SECONDS - $START))
if (( TOTAL > 3 ));
then
    echo -e "BUILD query1 VIRTUAL VIEW:\tFAILED ($TOTAL)"
else
    echo -e "BUILD query1 VIRTUAL VIEW:\tOK ($TOTAL)"
fi

$SKDB --data /tmp/test.db --connect query1 --updates /tmp/query1 > /dev/null

###############################################################################
# Query 2
###############################################################################

rm -f /tmp/query2

START=$SECONDS
cat query2.sql | $SKDB --data /tmp/test.db
TOTAL=$(($SECONDS - $START))
if (( TOTAL > 20 ));
then
    echo -e "BUILD query2 VIRTUAL VIEW:\tFAILED ($TOTAL)"
else
    echo -e "BUILD query2 VIRTUAL VIEW:\tOK ($TOTAL)"
fi

$SKDB --data /tmp/test.db --connect query2 --updates /tmp/query2 > /dev/null

###############################################################################
# Query 3
###############################################################################

rm -f /tmp/query3

START=$SECONDS
cat query3.sql | $SKDB --data /tmp/test.db
TOTAL=$(($SECONDS - $START))
if (( TOTAL > 30 ));
then
    echo -e "BUILD query3 VIRTUAL VIEW:\tFAILED ($TOTAL)"
else
    echo -e "BUILD query3 VIRTUAL VIEW:\tOK ($TOTAL)"
fi

$SKDB --data /tmp/test.db --connect query3 --updates /tmp/query3 > /dev/null

###############################################################################
# DUMP AND CHECK SIZE
###############################################################################

# rm -f /tmp/test2.db
# $SKDB --init /tmp/test2.db
# $SKDB --data /tmp/test.db --dump | $SKDB --data /tmp/test2.db
# $SKDB --compact --data /tmp/test2.db

# mv /tmp/test2.db /tmp/test.db

###############################################################################
# MASS DELETE
###############################################################################

START=$SECONDS
echo "delete from customer where c_custkey <= 10000;" | $SKDB --data /tmp/test.db
TOTAL=$(($SECONDS - $START))
if (( TOTAL > 50 ));
then
    echo -e "RUN DELETE:\tFAILED ($TOTAL)"
else
    echo -e "RUN DELETE:\tOK ($TOTAL)"
fi

###############################################################################
# SMALL DELETE
###############################################################################

START=$SECONDS
echo "delete from lineitem where l_orderkey < 10;" | $SKDB --data /tmp/test.db
TOTAL=$(($SECONDS - $START))
if (( TOTAL > 5 ));
then
    echo -e "RUN DELETE2:\tFAILED ($TOTAL)"
else
    echo -e "RUN DELETE2:\tOK ($TOTAL)"
fi